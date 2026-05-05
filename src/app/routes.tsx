import { createBrowserRouter } from "react-router";
import { MobileLayout } from "./components/layout/MobileLayout";
import { Home } from "./pages/Home";
import { Ratings } from "./pages/Ratings";
import { LearnAndEarn, Missions } from "./pages/Missions";
import { Market } from "./pages/Market";
import { Profile } from "./pages/Profile";
import { Games } from "./pages/Games";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MobileLayout,
    children: [
      { index: true, Component: Games },
      { path: "ratings", Component: Ratings },
      { path: "tap", Component: Home },
      { path: "missions", Component: Missions },
      { path: "learn", Component: LearnAndEarn },
      { path: "market", Component: Market },
      { path: "profile", Component: Profile },
    ],
  },
]);
