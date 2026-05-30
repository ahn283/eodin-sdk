import { createBrowserRouter } from "react-router";
import Root from "./components/Root";
import DeepLinkPage from "./components/DeepLinkPage";
import DesignSystem from "./components/DesignSystem";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: DeepLinkPage },
      { path: "design-system", Component: DesignSystem },
    ],
  },
]);
