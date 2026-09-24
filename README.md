# Fan

A simple fan noise app for sleeping. It's a web app you add to your phone's
home screen, where it works like a regular app, even offline.

- **Speed:** Low, Medium or High. Higher speeds are brighter and louder.
- **Sleep timer:** turns off after 30 minutes, 1, 2 or 8 hours. Where the
  browser allows it, the sound fades out over the last minute.
- Keeps playing with the screen locked, and you can pause it from the lock screen.
- The sound is generated on the phone, so there are no audio files to download.

## Put it on your phone

The app needs to be served over HTTPS. The easiest way is GitHub Pages:

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the
   branch with this code and the `/ (root)` folder, then click **Save**.
3. After a minute or so the page shows the site's address, like
   `https://<your-username>.github.io/fan/`.
4. Open that address on your phone:
   - **iPhone (Safari):** tap Share → **Add to Home Screen**.
   - **Android (Chrome):** tap ⋮ → **Add to Home screen** (or **Install app**).

GitHub Pages on a private repository needs a paid GitHub plan. Other options
are making the repository public, or dragging this folder onto
[Netlify Drop](https://app.netlify.com/drop).

## Notes

- On iPhone, the app can't change its own volume, so it hides the volume slider.
  Use the phone's volume buttons instead. For the same reason, the sleep timer
  stops the sound without fading it out.
- To run it on your computer: `python3 -m http.server` in this folder, then
  open http://localhost:8000.
