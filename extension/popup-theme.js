// The popup shares the app's origin, so it can read the appearance the app
// mirrors into localStorage (see the boot script in app.html) and open in the
// same light or dark the user chose there.
(function () {
  try {
    var saved = localStorage.getItem("focusos:appearance");
    var mode = saved ? JSON.parse(saved).mode : null;
    var pref = saved ? JSON.parse(saved).pref : "system";
    if (!mode || pref === "system") {
      mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.dataset.mode = mode;
  } catch {
    // The markup's dark default stands.
  }
})();
