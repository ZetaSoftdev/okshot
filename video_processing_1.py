import whisperx
import ffmpeg
import random
import srt
from datetime import timedelta
import os
import sys
import json

from moviepy.video.io.VideoFileClip import VideoFileClip
from clipsai import ClipFinder, Transcriber


def videoProcessing(config):
    # Part 1: Clip Finder and Processing
    def process_clip(video_path, start_time, end_time, index):
        with VideoFileClip(video_path) as video:
            new_clip = video.subclip(start_time, end_time)
            clip_file_path = os.path.join(config["clips_folder_path"], f"clip_{index + 1}.mp4")
            new_clip.write_videofile(
                clip_file_path,
                codec="libx264",
                preset="ultrafast",  # Use a faster preset
                threads=1  # No need for multiple threads since it's not parallel
            )
        return clip_file_path

    transcriber = Transcriber()
    clipfinder = ClipFinder()
    transcription = transcriber.transcribe(audio_file_path=config["input_video"])
    clips = clipfinder.find_clips(transcription=transcription)
    filtered_clips = [
        clip for clip in clips if (clip.end_time - clip.start_time) <= 90
    ]
    
    clip_files = []
    for i, clip in enumerate(filtered_clips):
        clip_file_path = process_clip(config["input_video"], clip.start_time, clip.end_time, i)
        clip_files.append(clip_file_path)

    # Part 2: Process each clip for audio extraction, transcription, and subtitle creation
    for i, clip_file in enumerate(clip_files):
        # Generate filenames based on the clip index
        audio_file = os.path.join(config["clips_folder_path"], f"clip_{i + 1}_audio.wav")
        srt_file = os.path.join(config["clips_folder_path"], f"clip_{i + 1}_srt.srt")
        ass_file = os.path.join(config["clips_folder_path"], f"clip_{i + 1}_ass.ass")
        
        # Step 1: Extract audio from the clip
        ffmpeg.input(clip_file).output(audio_file).run()

        # Step 2: Transcribe audio with WhisperX
        model = whisperx.load_model("large-v2", config["device"], compute_type=config["compute_type"])
        audio = whisperx.load_audio(audio_file)
        result = model.transcribe(audio, batch_size=config["batch_size"])

        # Step 3: Align Whisper output (with word-level alignment)
        model_a, metadata = whisperx.load_align_model(language_code=config["language"], device=config["device"])
        result = whisperx.align(result["segments"], model_a, metadata, audio, device=config["device"], return_char_alignments=True)

        # Step 4: Create subtitles with random 2-4 words per line
        subtitles = []
        word_timings = []

        for segment in result["segments"]:
            words = segment['words']
            index = 0

            while index < len(words):
                group_size = random.randint(config["group_size_min"], config["group_size_max"])
                group = words[index:index + group_size]
                if not group:
                    break

                # Check if all words have 'start' and 'end' keys
                valid_group = [word for word in group if 'start' in word and 'end' in word]

                if not valid_group:
                    index += group_size
                    continue

                start_time = valid_group[0]['start']
                end_time = valid_group[-1]['end']

                # Plain text for SRT
                text = ' '.join([word['word'] for word in valid_group])

                subtitle = srt.Subtitle(
                    index=len(subtitles) + 1,
                    start=timedelta(seconds=start_time),
                    end=timedelta(seconds=end_time),
                    content=text
                )
                subtitles.append(subtitle)
                word_timings.append(valid_group)
                index += group_size

        # Step 5: Convert subtitles to SRT format and save to file
        with open(srt_file, "w", encoding="utf-8") as f:
            f.write(srt.compose(subtitles))

        # Step 6: Create an ASS file that highlights the spoken word exactly when it starts
        ass_subtitles = ["[Script Info]",
                         "Title: Styled Subtitles",
                         "ScriptType: v4.00+",
                         "",
                         "[V4+ Styles]",
                         "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
                         f"Style: Default,{config['fontname']},{config['fontsize']},{config['primary_color']},{config['secondary_color']},{config['outline_color']},{config['back_color']},{config['bold']},{config['italic']},{config['underline']},{config['strike_out']},{config['scale_x']},{config['scale_y']},{config['spacing']},{config['angle']},{config['border_style']},{config['outline']},{config['shadow']},{config['alignment']},{config['margin_l']},{config['margin_r']},{config['margin_v']},{config['encoding']}",
                         f"Style: Highlight,{config['fontname']},{config['fontsize']},{config['highlight_color']},{config['highlight_color']},{config['highlight_bg_color']},{config['highlight_bg_color']},{config['bold']},{config['italic']},{config['underline']},{config['strike_out']},{config['scale_x']},{config['scale_y']},{config['spacing']},{config['angle']},3,{config['bg_radius']},{config['bg_radius']},2,{config['margin_l']},{config['margin_r']},{config['margin_v']},{config['encoding']}",
                         "",
                         "[Events]",
                         "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]

        # Load the SRT file and process it to create an ASS file with highlighted spoken word
        for subtitle, timing_group in zip(subtitles, word_timings):
            words = subtitle.content.split()

            for j, word in enumerate(words):
                start_word_time = timedelta(seconds=timing_group[j]['start'])
                end_word_time = timedelta(seconds=timing_group[j]['end'])

                # Build the subtitle line with dynamic highlighting
                highlighted_text = ''
                for k, w in enumerate(words):
                    if k < j:
                        highlighted_text += f"{{\\rDefault}}{w} "
                    elif k == j:
                        highlighted_text += f"{{\\rHighlight}}{{\\bord{config['bg_radius']}}}{{\\xbord1.5}}{{\\ybord1.5}}{{\\shad0}}{w}{{\\rDefault}} "
                    else:
                        highlighted_text += f"{w} "

                highlighted_text = highlighted_text.strip()  # Remove trailing space

                dialogue_start_time = '{:01}:{:02}:{:02}.{:02}'.format(int(start_word_time.total_seconds() // 3600),
                                                                       int((start_word_time.total_seconds() % 3600) // 60),
                                                                       int(start_word_time.total_seconds() % 60),
                                                                       int((start_word_time.total_seconds() % 1) * 100))

                dialogue_end_time = '{:01}:{:02}:{:02}.{:02}'.format(int(end_word_time.total_seconds() // 3600),
                                                                     int((end_word_time.total_seconds() % 3600) // 60),
                                                                     int(end_word_time.total_seconds() % 60),
                                                                     int((end_word_time.total_seconds() % 1) * 100))

                ass_subtitles.append(f"Dialogue: 0,{dialogue_start_time},{dialogue_end_time},Highlight,,0,0,0,,{highlighted_text}")

        # Step 7: Save the ASS file
        with open(ass_file, "w", encoding="utf-8") as f:
            f.write("\n".join(ass_subtitles))

        # Step 8: Burn subtitles into the video using ffmpeg
        output_clip_file = os.path.join(config["clips_folder_path"], f"clip_{i + 1}_subtitled.mp4")
        ffmpeg.input(clip_file).output(output_clip_file, vf=f"subtitles={ass_file}:force_style='Alignment=2'").run()

        print(f"Styled subtitled video saved as {output_clip_file}")

    print("All clips processed successfully.")


def main():
    config = json.loads(sys.argv[1])
    videoProcessing(config)


if __name__ == "__main__":
    main()
