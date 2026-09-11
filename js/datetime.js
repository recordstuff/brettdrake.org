"use strict";

(() => {
  const localDateTime = document.getElementById("localDateTime");
  const now = new Date();
  const dateTimeFormat = new Intl.DateTimeFormat([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  localDateTime.dateTime = now.toISOString();
  localDateTime.textContent = dateTimeFormat.format(now);
})();
