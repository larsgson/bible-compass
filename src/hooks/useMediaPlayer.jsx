import { useContext } from "react";
import MediaPlayerContext from "../context/MediaPlayerContext";

const useMediaPlayer = () => {
  const context = useContext(MediaPlayerContext);

  if (!context) {
    throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
  }

  return context;
};

export default useMediaPlayer;
