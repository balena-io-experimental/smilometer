const _ = require('lodash');
const fs = require('fs');
const childProcess = require('child_process');
const cognitive = require('cognitive-services');
const express = require('express');
const Blinkt = require('node-blinkt');

const leds = new Blinkt();
leds.setup();
leds.clearAll();
leds.sendUpdate();

// Blink the leds with a low red light, to show we're recording
let ledsOn = false;
setInterval(() => {
  if (ledsOn) {
    leds.clearAll();
  } else {
    leds.setAllPixels(255, 0, 0, 0.1);
  }
  ledsOn = !ledsOn;
  leds.sendUpdate();
}, 1000);

const PHOTO_FREQUENCY = 5000;

const EMOTIONS = [
  "anger",
  "disgust",
  "fear",
  "happiness",
  "neutral",
  "sadness",
  "surprise"
]

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
      submitToAzure(photoId);
    }
  });
}, PHOTO_FREQUENCY);

const emotionClient = new cognitive.emotion({
  apiKey: process.env.EMOTION_API_KEY,
  endpoint: 'westus.api.cognitive.microsoft.com'
});

function submitToAzure(photoId) {
  emotionClient.emotionRecognition({
      headers: { 'Content-type': 'application/octet-stream' },
      body: fs.readFileSync(`/tmp/photo-${photoId}.jpg`)
  })
  .then((faces) => {
    console.log(faces);
    scores.push(_.zipObject(EMOTIONS, EMOTIONS.map((emotion) =>
      _.meanBy(faces, (face) => face.scores[emotion])
    )));

    console.log(scores[scores.length - 1]);
  })
  .catch((err) => {
      console.error('Error submitting to the emotion API: ' + err.toString());
  })
}

const app = express();
app.get('/', (req, res) => {
  let chartData = EMOTIONS.map((emotion) => {
    return {
      x: _.range(scores.length),
      y: scores.map((score) => score[emotion]),
      type: 'scatter',
      name: _.startCase(emotion)
    };
  });

  res.status(200).send(`<html>
  <head>
      <title>Smilometer</title>
      <script type="text/javascript" src="https://cdn.plot.ly/plotly-latest.min.js"></script>
      <script>
      let data = ${chartData};
      Plotly.newPlot('emotionChart', data);
      </script>
  </head>
  <body>
    <h1>So how did that make you feel?</h1>
    <div id="emotionChart"></div>
  </body>
</html>`);
});

app.listen(80, () => console.log('Server started on port 80'));