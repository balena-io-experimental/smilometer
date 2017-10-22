const fs = require('fs');
const childProcess = require('child_process');
const cognitive = require('cognitive-services');
const express = require('express');

// TODO: blink a red light, to show we're recording?

const PHOTO_FREQUENCY = 5000;
const scores = []

setInterval(() => {
  let photoId = Date.now();
  let camProc = childProcess.spawn('raspistill', ['-vf', '-hf', '-o', `/tmp/photo-${photoId}.jpg`], {
    stdio: 'inherit'
  });

  camProc.on('close', (code) => {
    if (code !== 0) {
      console.warn(`raspistill exited with code ${code}`);
    } else {
      console.debug(`Took photo ${photoId}`);
      submitToAzure(photoid);
    }
  });
}, PHOTO_FREQUENCY);

const emotionClient = new cognitive.emotion({
  apiKey: process.env.EMOTION_API_KEY,
  endpoint: 'https://westus.api.cognitive.microsoft.com/emotion/v1.0'
});

function submitToAzure(photoId) {
  emotionClient.emotionRecognition({
      headers: { 'Content-type': 'application/octet-stream' },
      body: fs.readFileSync(`/tmp/photo-${photoId}.jpg`)
  })
  .then((faces) => {
    console.log(faces);
    scores.push(faces.map((face) => face.scores));
  })
  .catch((err) => {
      console.error('Error submitting to the emotion API: ' + err.toString());
  })
}

const app = express();
app.get('', (req, res) => {
  res.status(200).send('Hi there!');
  // TODO: Build an HTML page the uses the results, and shows a nice graph
});

app.listen(80, () => console.log('Server started on port 80'));