# FakeMyRun Clone

This project is a clone of the FakeMyRun website, allowing users to create and download fake running routes as GPX files. It includes features like drawing routes manually, generating shape-based routes (circles, hearts), and searching for locations.

## Project Structure

The main pages of the website are:
- `index.html`: The main landing page.
- `how-it-works.html`: Explains how the tool functions.
- `how-to-upload.html`: Provides instructions on uploading GPX files to third-party services.
- `create.html`: The interactive page for creating custom running routes. This is where most of the functionality resides.
- `terms.html`: Terms of service.
- `style.css`: Main stylesheet for all pages.
- `map.js`: JavaScript file containing the logic for the interactive map and route creation features on `create.html`.

## How to Run Locally

This project consists of static HTML, CSS, and JavaScript files. No special build steps or local server (beyond what a browser might require for certain API calls like Nominatim over `file:///` protocol) are strictly necessary to view the basic HTML structure.

1.  **Clone or Download the Repository**:
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```
    (Replace `<repository_url>` and `<repository_directory>` with actual values if known, otherwise use generic placeholders.)
    Alternatively, download the source code as a ZIP file and extract it.

2.  **Open in a Browser**:
    Navigate to the project directory and open the `index.html` file in your web browser to start exploring the website.
    To use the route creation tool, open `create.html`.

3.  **Important Note for `create.html` (Location Search)**:
    The location search functionality on `create.html` uses the Nominatim API (HTTPS). Some browsers might block API requests from `file:///` URLs due to security policies (CORS). If location search doesn't work when opening `create.html` directly from the file system, you might need to serve the files via a simple local HTTP server.

    **Optional: Using a Simple Local HTTP Server (if needed for APIs)**
    If you have Python installed, you can run a simple HTTP server from the project's root directory:

    - For Python 3:
      ```bash
      python -m http.server
      ```
    - For Python 2:
      ```bash
      python -m SimpleHTTPServer
      ```
    Then, open your browser and navigate to `http://localhost:8000` (or the port shown by the server).

## Browser Compatibility

The application has been developed and tested primarily on modern versions of Google Chrome. While it uses standard web technologies, thorough testing on other browsers (Firefox, Safari, Edge) has not been performed.
