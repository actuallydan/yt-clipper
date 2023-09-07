import express, { Request, Response } from "express";
import { spawn } from "child_process";
import youtubedl from "youtube-dl-exec";
import fs from "fs";
import { performance } from "perf_hooks";

const app = express();
const port = 3030;
const videoDirectory = "clipped_videos"; // Specify the directory to save clipped videos

app.get("/clip/*", async (req: Request, res: Response) => {
  console.log("DO STUFF");

  console.log(req.params, req.query);
  // { '0': 'https://www.youtube.com/watch' } { v: '5CdTI1ytAsE', ab_channel: 'TheCosmonautVarietyHour' }

  const videoId = req.query.v;

  const youtubeLink = (req.params[0] + "?v=" + req.query.v) as string;
  let start = req.query.start as number;
  let end = req.query.end as number; // represents the duration in seconds from the start, NOT the absolute duration end

  const t0 = performance.now();

  console.log(youtubeLink);

  if (!youtubeLink) {
    return res.status(400).send("Missing link, start, or end");
  }

  if (!start) {
    start = 100;
  }

  if (!end) {
    end = 300;
  }

  try {
    if (!fs.existsSync(videoDirectory)) {
      fs.mkdirSync(videoDirectory);
    }

    let videoTitle = (await youtubedl(youtubeLink, {
      getFilename: true,
    })) as unknown as string;

    const clippedVideoFilename = `${videoId}-${start}-${end}.mp4`;
    const clippedVideoPath = `${videoDirectory}/${clippedVideoFilename}`;

    if (!fs.existsSync(clippedVideoPath)) {
      await youtubedl(youtubeLink, {
        format: "bestvideo[height<=720]+bestaudio/best[height<=720]",
      });

      console.log(`downloaded video in ${performance.now() - t0} seconds`);

      const newFullPath = `${videoDirectory}/${encodeURI(videoTitle)}`;

      fs.renameSync(videoTitle, newFullPath);

      videoTitle = newFullPath;

      const ffmpegProcess = spawn("ffmpeg", [
        "-ss",
        start.toString(),
        "-i",
        newFullPath,
        "-to",
        (end - start).toString(),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        clippedVideoPath,
      ]);

      ffmpegProcess.stderr.on("data", (data) => {
        // for some reason ffmpeg's output is logged as stderr...
        // console.error(`FFmpeg error: ${data}`);
      });

      ffmpegProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`FFmpeg process exited with code ${code}`);
        }
        // https://www.youtube.com/watch?v=LEeJZCOS47I&ab_channel=Dan%27sReactNativeLab

        res.redirect("/" + clippedVideoPath);
        // res.setHeader("Content-Type", "text/html");

        // res.send(`
        //   <video src="${clippedVideoPath}" autoplay="true">
        //   </video>
        //   `);

        console.log(`took ${(performance.now() - t0) / 1000} seconds`);
        // delete the full-length video after use
        fs.unlink(newFullPath, () => {
          console.log("cleaned up file");
        });
      });
    } else {
      res.redirect("/" + clippedVideoPath);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).send("An error occurred");
  }
});

app.get("/get-local/:id", async (req: Request, res: Response) => {
  const videoId = req.params.id;

  if (!videoId) {
    res.status(400).send("Missing video id");
  }

  const youtubeLink = ("https://www.youtube.com/watch?v=" + videoId) as string;
  // let start = req.query.start as number;
  // let end = req.query.end as number; // represents the duration in seconds from the start, NOT the absolute duration end

  const t0 = performance.now();

  if (!youtubeLink) {
    return res.status(400).send("Missing link, start, or end");
  }

  try {
    if (!fs.existsSync(videoDirectory)) {
      fs.mkdirSync(videoDirectory);
    }

    let videoTitle = (await youtubedl(youtubeLink, {
      getFilename: true,
    })) as unknown as string;

    const newFullPath = `${videoDirectory}/${videoId}.mp4`;

    if (!fs.existsSync(newFullPath)) {
      await youtubedl(youtubeLink, {
        format: "bestvideo[height<=480]+bestaudio/best[height<=480]",
      });

      console.log(
        `downloaded video in ${(performance.now() - t0) / 1000} seconds`
      );

      fs.renameSync(videoTitle, newFullPath);
    }

    // get the length of the video in seconds
    const videoData = await youtubedl(youtubeLink, {
      dumpSingleJson: true,
    });

    const thumbnail = videoData.thumbnails.filter(
      (v) => v.height && v.width && v.resolution
    )[0];

    console.log(`took ${(performance.now() - t0) / 1000} seconds`);

    res.json({
      thumbnail: thumbnail.url,
      length: videoData.duration,
      link: `/${newFullPath}`,
    });

    // delete the full-length video after use
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).send("An error occurred");
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

app.get("/clipped_videos/:path", (req, res) => {
  console.log("SERVE");
  console.log(req.params);

  const file = `clipped_videos/${req.params.path}`;
  const length = fs.statSync(file);
  const stream = fs.createReadStream(file);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", length.size);
  stream.pipe(res);
});

app.use("*", express.static("public"));
