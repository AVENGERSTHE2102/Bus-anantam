# Deploying OSRM on Render

This repository contains the preprocessed Dombivli routing graph required by
OSRM. `Dockerfile.osrm` copies those `dombivli.osrm*` files into the official
OSRM image and starts an MLD routing server on port 5000.

## Create the Render service

1. Push this repository to GitHub.
2. In Render, select **New → Private Service**.
3. Select this repository and the same region as the BusTracker backend.
4. Set **Runtime** to **Docker**.
5. Set **Dockerfile Path** to `./Dockerfile.osrm` and leave the Docker build
   context at the repository root (`.`).
6. Deploy the service.

After it is healthy, copy its address from **Connect → Internal**. It will look
similar to `bustracker-osrm-xxxx:5000`.

## Connect the backend

Set this environment variable on the **backend Render web service** (not in the
Android app):

```env
OSRM_BASE_URL=http://bustracker-osrm-xxxx:5000
```

Then redeploy the backend. Keep the backend and OSRM service in the same Render
workspace and region, so this address remains private.

## Verify it

From the backend's Render Shell, run:

```bash
curl "${OSRM_BASE_URL}/route/v1/driving/73.117452,19.203479;73.090905,19.219640?overview=false"
```

The response should contain `"code":"Ok"`. The mobile app only uses the
backend's public URL; it never connects to OSRM directly.
