import { useEffect, useRef, useState } from "react";
import {
  Camera, Plus, Sun, Moon, Maximize2, X, Wifi,
  Circle, Trash2, Monitor
} from "lucide-react";
import Hls from "hls.js";
import "./App.css";

const API_BASE = "http://10.40.40.209:8000";

function HLSVideo({ src, onFullscreen }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 0,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <div
      className="camera-view-only"
      onDoubleClick={onFullscreen}
    >
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
      />

      <button
        className="video-fullscreen-btn"
        onClick={(e) => {
          e.stopPropagation();
          onFullscreen();
        }}
        title="Fullscreen"
        aria-label="Fullscreen"
      >
        <Maximize2 size={20} />
      </button>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState("light");
  
const [cameras, setCameras] = useState([]);
  
  // Restore existing live streams after browser refresh.
  useEffect(() => {
    let cancelled = false;

    async function restoreCameras() {
      try {
        const response = await fetch(`${API_BASE}/api/cameras`);
        if (!response.ok) {
          throw new Error(`Camera restore failed: ${response.status}`);
        }

        const saved = await response.json();
        if (cancelled) return;

        setCameras(saved
          .filter((camera) => camera.status === "running")
          .map((camera) => ({
            id: camera.camera_id,
            ip: camera.ip,
            status: "connected",
            streamUrl: camera.stream_url,
          }))
        );
      } catch (error) {
        console.error("Could not restore cameras:", error);
      }
    }

    restoreCameras();
    return () => { cancelled = true; };
  }, []);


useEffect(() => {
  let cancelled = false;

  async function restoreCameras() {
    try {
      const response = await fetch(`${API_BASE}/api/cameras`);
      if (!response.ok) throw new Error("Could not restore cameras");

      const saved = await response.json();
      if (cancelled) return;

      setCameras(
        saved
          .filter((camera) => camera.status === "running")
          .map((camera) => ({
            id: camera.camera_id,
            ip: camera.ip,
            status: "connected",
            streamUrl: camera.stream_url,
          }))
      );
    } catch (error) {
      console.error("Camera restore failed:", error);
    }
  }

  restoreCameras();

  return () => {
    cancelled = true;
  };
}, []);
  const [ip, setIp] = useState("");
  const [password, setPassword] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function addCamera(e) {
    e.preventDefault();
    const address = ip.trim();
    if (!address || !password || connecting) return;

    setConnecting(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/cameras/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: address, password }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Could not connect to camera.");
      }

      const camera = {
        id: result.camera_id,
        ip: address,
        status: result.status === "connected" ? "connected" : "pending",
        streamUrl: result.stream_url,
      };

      setCameras((old) => [...old, camera]);
      setShowAdd(false);
      setIp("");
      setPassword("");
      setMessage(
        result.status === "connected"
          ? `Camera ${address} connected.`
          : `Camera ${address} is starting. The stream may take a few seconds.`
      );
    } catch (error) {
      setMessage(
        `${error.message} Check that the Python backend and FFmpeg are running.`
      );
    } finally {
      setConnecting(false);
    }
  }

  async function removeCamera(camera) {
    setCameras((old) => old.filter((c) => c.id !== camera.id));

    try {
      await fetch(`${API_BASE}/api/cameras/${encodeURIComponent(camera.id)}`, {
        method: "DELETE",
      });
    } catch {
      // The camera is removed from the UI even if the backend is offline.
    }
  }

  async function toggleFullscreen(e) {
    e.stopPropagation();
    const tile = e.currentTarget.closest(".camera-tile");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (tile) {
        await tile.requestFullscreen();
      }
    } catch {
      setMessage("Fullscreen is not available in this browser.");
    }
  }

  return (
    <div className={`app ${theme}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Camera size={25} /></div>
          <div>
            <h1>Sunic</h1>
            <p>CAMERA MONITORING</p>
          </div>
        </div>

        <div className="header-actions">
          <span className="system-status">
            <Circle size={9} fill="currentColor" />
            Monitoring
          </span>
          <button
            className="theme-btn"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle theme"
            title="Change theme"
          >
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <button className="add-btn" onClick={() => setShowAdd(true)}>
            <Plus size={18} /><span>Add Camera</span>
          </button>
        </div>
      </header>

      <main className="monitor">
        <div className="monitor-toolbar">
          <div>
            <h2>Live Monitoring</h2>
            <p>{cameras.length} camera{cameras.length === 1 ? "" : "s"} configured</p>
          </div>
          <div className="toolbar-right">
            <Monitor size={17} /><span>Auto responsive layout</span>
          </div>
        </div>

        {message && (
          <div className="notice" role="status">
            {message}
            <button onClick={() => setMessage("")} aria-label="Dismiss"><X size={15} /></button>
          </div>
        )}

        {cameras.length === 0 ? (
          <section className="empty-screen">
            <div className="empty-camera"><Camera size={38} /></div>
            <h2>Ready to monitor</h2>
            <p>Add your camera IP address and password to get started.</p>
            <button className="add-btn" onClick={() => setShowAdd(true)}>
              <Plus size={18} /> Add Camera
            </button>
          </section>
        ) : (
         <section className="camera-grid">
  {cameras.map((camera) => (
    <article
      className="camera-tile"
      key={camera.id}
      data-camera-id={camera.id}
    >
      {camera.streamUrl ? (
        <HLSVideo
          src={camera.streamUrl}
          onFullscreen={(e) => {
            const tile = document.querySelector(
              `[data-camera-id="${camera.id}"]`
            );

            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            } else {
              tile?.requestFullscreen().catch(() => {});
            }
          }}
        />
      ) : (
        <div className="camera-view-only waiting">
          <div className="waiting-icon">
            <Camera size={27} />
          </div>
          <strong>Waiting for camera stream</strong>
        </div>
      )}
    </article>
  ))}
</section>
        )}

        <footer className="footer">
          <span>Sunic Camera Monitoring</span>
          <span>Live surveillance dashboard</span>
        </footer>
      </main>

      {showAdd && (
        <div className="modal-overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setShowAdd(false);
        }}>
          <form className="add-modal" onSubmit={addCamera}>
            <div className="modal-head">
              <div className="modal-brand"><Camera size={22} /></div>
              <div>
                <h2>Add Camera</h2>
                <p>Enter camera connection details.</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowAdd(false)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <div className="modal-fields">
              <label>
                <span>IP Address</span>
                <input
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.1.100"
                  autoFocus
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Camera password"
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="add-btn" type="submit" disabled={connecting}>
                <Wifi size={17} />{connecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
