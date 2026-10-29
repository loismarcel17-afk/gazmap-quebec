import { preload } from "react-dom";
import { HomeView } from "@/components/HomeView";
import { STATIONS_URL } from "@/lib/stations-api";

export default function HomePage() {
  // Tells the browser, from the HTML itself, to start downloading the station
  // list now, alongside the JavaScript, instead of after it has run (~1.5 s
  // sooner on a phone in 4G). fetchStationsSnapshot() then reuses this download.
  preload(STATIONS_URL, { as: "fetch", crossOrigin: "anonymous" });
  return <HomeView />;
}
