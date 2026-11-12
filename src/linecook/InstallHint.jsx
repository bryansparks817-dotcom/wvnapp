import { useEffect, useState } from "react";

const DISMISSED = "thePass.installHint.v1";

function standalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function dismissed() {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

// On the sign-in screen, until the app is on the home screen: Android gets an
// install button, iPhone gets the Share → Add to Home Screen steps.
export default function InstallHint() {
  const [prompt, setPrompt] = useState(null);
  const [hidden, setHidden] = useState(() => standalone() || dismissed());
  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (hidden) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // nothing to save
    }
    setHidden(true);
  };
  return (
    <section className="pass__install" aria-label="Add to home screen">
      <span className="pass__countlabel">PUT THE PASS ON YOUR HOME SCREEN</span>
      {prompt ? (
        <button type="button" className="pass__installbtn" onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); close(); }}>
          Install the app
        </button>
      ) : (
        <p className="pass__hint">
          {ios ? "In Safari, tap Share, then Add to Home Screen." : "In your browser menu, tap Add to Home screen or Install app."} It opens full screen, like an app.
        </p>
      )}
      <button type="button" className="pass__ghost" onClick={close}>Not now</button>
    </section>
  );
}
