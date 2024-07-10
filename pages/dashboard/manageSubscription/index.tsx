// Updated ManageSubscription component with improved design
import { useTranslation } from 'next-i18next';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Link from 'next/link';
import ConfirmationModal from '@/components/confirmation'; // Adjust the import path as per your project structure
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import env from '@/lib/env';
import toast from 'react-hot-toast';

function ManageSubscription() {
  const { t } = useTranslation('common');
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // State to manage modal visibility
  const { data } = useSession();
  const id = data?.user?.id;
  const [loading, setLoading] = useState(false); // State to manage loading state
  const fetchSubscription = useCallback(async () => {
    try {
      const res = await axios.post('/api/subscriptions/subscription', {
        userId: id,
        status: true,
      });
      const activeSubscription = res.data.data;
      setCurrentSubscription(activeSubscription);
    } catch (error) {
      console.error('Error fetching current subscription:', error);
    }
  }, [id, setCurrentSubscription]);

  useEffect(() => {
    if (id) {
      fetchSubscription();
    }
  }, [fetchSubscription, id]);

  const handleDelete = async () => {
    try {
      setLoading(true); // Show loader
      const response = await axios.post('/api/subscriptions/cancel', {
        subscriptionId: currentSubscription.stripe_subscriptionId,
      });
      if (response.data.status === 'true') {
        setCurrentSubscription(response.data.data);
        toast.success('Subscription Cancelled successfully');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription');
    } finally {
      setLoading(false); // Hide loader
      setShowDeleteConfirm(false); // Close the confirmation modal after deletion
    }
  };

  const renderUsage = () => {
    if (!currentSubscription) return null;

    const { subscriptionPackage, subscriptionUsage } = currentSubscription;
    const usage = subscriptionUsage[0];

    return (
      <div className="bg-white shadow-lg rounded-lg p-6 mb-4">
        <div className="mb-4 flex justify-between items-center border-b-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('current-package')}
          </h3>
          <p className="text-sm text-gray-500">
            {subscriptionPackage.subscription_type}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 mb-4">
          <div className="flex justify-between border-b-2">
            <span className="text-gray-700">{t('upload-limit')}</span>
            <span className="text-gray-900">
              {usage.upload_count}/{subscriptionPackage.upload_video_limit}
            </span>
          </div>
          <div className="flex justify-between border-b-2">
            <span className="text-gray-700">{t('generate-clips')}</span>
            <span className="text-gray-900">
              {usage.clip_count}/{subscriptionPackage.generate_clips}
            </span>
          </div>
          <div className="flex justify-between border-b-2">
            <span className="text-gray-700">{t('total-minutes')}</span>
            <span className="text-gray-900">
              {usage.min}/{subscriptionPackage.total_min}
            </span>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    console.log(currentSubscription);
  }, [currentSubscription]);

  return (
<div className="container mx-auto pt-[50px] max-w-full px-4 sm:px-6 lg:px-8">
  {currentSubscription && currentSubscription.cancelAt && (
    <div
      className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6"
      role="alert"
    >
      <p className="font-bold">{t('subscription-cancelled')}</p>
      <p>
        {t('your-subscription-will-end-on')}:{' '}
        {new Date(currentSubscription.cancelAt).toLocaleDateString()}
      </p>
    </div>
  )}
  {currentSubscription ? (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentSubscription?.subscriptionPackage?.subscription_type}
        </h2>
        <p className="text-sm pt-2 pl-2">
          ({currentSubscription?.subscriptionPackage?.sub_dur_type})
        </p>
      </div>
      {renderUsage()}
      <div className="flex flex-col sm:flex-row justify-end space-y-4 sm:space-y-0 sm:space-x-4">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full sm:w-auto pr-[2rem] pl-[2rem] py-2.5 text-sm font-bold text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-red-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
          disabled={currentSubscription && currentSubscription.cancelAt}
        >
          {t('cancel')}
        </button>
        <Link href="/dashboard/manageSubscription/upgradeSubscription">
          <button
            className="w-full sm:w-auto pr-[2rem] pl-[2rem] bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            disabled={currentSubscription && currentSubscription.cancelAt}
          >
            {t('upgrade')}
          </button>
        </Link>
      </div>
    </div>
  ) : (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6 text-center max-w-full">
      <p className="text-lg font-bold text-gray-900 mb-4">
        {t('no-subscription')}
      </p>
      <Link href="/pricing">
        <button className="w-full sm:w-auto bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300">
          {t('get-started')}
        </button>
      </Link>
    </div>
  )}

  <ConfirmationModal
    isOpen={showDeleteConfirm}
    title={t('Confirmation')}
    message={t('Are you sure you want to Delete')}
    onConfirm={handleDelete}
    onCancel={() => setShowDeleteConfirm(false)}
  />

  {loading && (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <svg
        className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2611 1.69443 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5685 10.4717 44.0642 10.1071C47.8517 9.53638 51.7191 9.52633 55.5407 10.0869C60.8788 10.8577 65.9923 12.7195 70.6331 15.5806C75.2738 18.4418 79.342 22.2395 82.5849 26.746C84.9136 29.966 86.7992 33.4786 88.1813 37.2334C89.083 39.583 91.5423 40.9164 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  )}
</div>

  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  // Redirect to login page if landing page is disabled
  if (env.hideLandingPage) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: true,
      },
    };
  }

  const { locale } = context;

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
};

export default ManageSubscription;
