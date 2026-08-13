// `npm start` — runs the local data server and the CRA dev server together.
//
// They are a pair now. The editable data lives in content/, which CRA cannot
// serve (see scripts/data-files.js for why it is not in public/), so without
// the data server the board loads with no jobs at all. Starting one without the
// other is a mistake with no useful failure mode, so this starts both.
//
// The data server is a child process and is killed when this one exits, which
// is the point of doing it here rather than with a background `&` in the npm
// script: an orphaned listener on port 4000 blocks every later start.

const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const PORT = 4000;

// Is something already listening? Someone may be running `npm run dev-server`
// in another terminal, and starting a second one only produces EADDRINUSE.
function portInUse() {
  return new Promise((resolve) => {
    const socket = net
      .connect({ port: PORT, host: '127.0.0.1' })
      .on('connect', () => (socket.end(), resolve(true)))
      .on('error', () => resolve(false));
    socket.setTimeout(500, () => (socket.destroy(), resolve(false)));
  });
}

// …and if so, is it actually our data server? A stale one from before the data
// moved out of public/ still answers on the port but serves none of the files,
// which looks exactly like "the site has no jobs" with nothing to explain it.
async function servesData() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/jobs.json`);
    return res.ok && String(res.headers.get('content-type')).includes('json');
  } catch {
    return false;
  }
}

async function main() {
  const children = [];

  if (await portInUse()) {
    if (await servesData()) {
      console.log(`Data server already running on port ${PORT} — reusing it.`);
    } else {
      console.warn(
        `\nSomething is listening on port ${PORT} but is not serving the data files.\n` +
          'It is probably an old copy of scripts/dev-server.js from before the data\n' +
          `moved into content/. Stop it and start again:  lsof -ti:${PORT} | xargs kill\n`
      );
    }
  } else {
    children.push(spawn(process.execPath, [path.join(__dirname, 'dev-server.js')], { stdio: 'inherit' }));
  }

  const cra = spawn(process.execPath, [require.resolve('react-scripts/bin/react-scripts.js'), 'start'], {
    stdio: 'inherit',
  });
  children.push(cra);

  const stop = () => children.forEach((c) => !c.killed && c.kill());
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('exit', stop);
  cra.on('exit', (code) => {
    stop();
    process.exit(code ?? 0);
  });
}

main();
