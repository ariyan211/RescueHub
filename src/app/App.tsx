import { RouterProvider } from "react-router";
import { IncidentProvider } from "../context/IncidentContext";
import { router } from "./routes";

export default function App() {
  return (
    <IncidentProvider>
      <RouterProvider router={router} />
    </IncidentProvider>
  );
}
