setInterval(() => {
  let timer = parseInt(sessionStorage.getItem("timer"));
  timer--;
  sessionStorage.setItem("timer", timer);

  const logTime = parseInt(sessionStorage.getItem("timer"));
  const logMinutes = Math.floor(logTime / 60);
  let logSeconds = logTime % 60;
  logSeconds = logSeconds < 10 ? "0" + logSeconds : logSeconds;
  timerDisplay.innerHTML = `${logMinutes}:${logSeconds}`;

  if (timer <= 0) window.location = "./";
}, 1000);
