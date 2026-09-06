# Deploy ClearMind

ClearMind is a static browser app served by a tiny Python server. It needs no database, API key, or third-party package.

## Option 1: Render (recommended)

1. Put this project in a GitHub repository. Include `app.py`, `web/`, `requirements.txt`, `Procfile`, and `render.yaml`.
2. Go to [render.com](https://render.com), create an account, and choose **New + > Blueprint**.
3. Connect GitHub and select the ClearMind repository.
4. Render detects `render.yaml`. Confirm the service name and click **Apply**.
5. Wait for the deploy to finish. Open the generated `onrender.com` URL.
6. Share that URL with friends. They can open it from a phone or desktop browser.

Manual Render setup also works:

- **Service type:** Web Service
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `python app.py`
- **Runtime:** Python

The server reads Render's `PORT` environment variable automatically.

## Option 2: PythonAnywhere

The included `wsgi.py` serves the same `web/` folder through PythonAnywhere's WSGI system.

1. Create a PythonAnywhere account and open **Web**.
2. Choose **Add a new web app**, select **Manual configuration**, and choose Python 3.
3. Open a **Bash console** and clone or upload this project into your home directory, for example:

   `git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git ~/ClearMind`

4. In the Web tab, set **Source code** to `/home/YOUR-USERNAME/ClearMind`.
5. Open the WSGI configuration file link and replace its contents with:

   ```python
   import sys
   sys.path.insert(0, '/home/YOUR-USERNAME/ClearMind')
   from wsgi import application
   ```

6. Click **Reload** in the Web tab.
7. Open the `YOUR-USERNAME.pythonanywhere.com` address shown there.

No virtualenv or package installation is needed because ClearMind uses Python's standard library only. If you do use a virtualenv, install from `requirements.txt` first.

## Important data note

Journal entries, goals, mood check-ins, and progress are stored in each browser's local storage. This means they stay on the device and browser where they were created; they are not shared with friends or synchronized between devices. The app does not currently collect or upload personal wellness data.

## Updating the live app

After deployment, push changes to the connected GitHub repository. Render redeploys automatically. PythonAnywhere requires pulling the changes in the Bash console and clicking **Reload** again.
