import { createBrowserRouter } from "react-router";
import AdminLayout from "../components/layout/AdminLayout";
import PublicLayout from "../components/layout/PublicLayout";
import DashboardPage from "../pages/DashboardPage";
import HotspotsPage from "../pages/HotspotsPage";
import HomePage from "../pages/HomePage";
import IncidentDetailPage from "../pages/IncidentDetailPage";
import IncidentListPage from "../pages/IncidentListPage";
import LiveMapPage from "../pages/LiveMapPage";
import NotFoundPage from "../pages/NotFoundPage";
import ReportPage from "../pages/ReportPage";
import TeamsPage from "../pages/TeamsPage";
import TrackPage from "../pages/TrackPage";

export const router = createBrowserRouter([
  {
    Component: PublicLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "report", Component: ReportPage },
      { path: "track", Component: TrackPage },
      { path: "hotspots", Component: HotspotsPage },
    ],
  },
  {
    path: "admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "incidents", Component: IncidentListPage },
      { path: "incidents/:id", Component: IncidentDetailPage },
      { path: "teams", Component: TeamsPage },
      { path: "map", Component: LiveMapPage },
    ],
  },
  { path: "*", Component: NotFoundPage },
]);
