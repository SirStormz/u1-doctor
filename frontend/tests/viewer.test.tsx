import { render, screen } from "@testing-library/react";
import { U1Viewer } from "../src/viz/U1Viewer";

const text = { autoRotate: "Auto-rotate", explode: "Exploded view", reset: "Reset", loading: "Loading", unavailable: "3D preview unavailable (WebGL)", hint: "hint", partNote: "note" };

test("viewer degrades gracefully without WebGL (jsdom) and never throws", async () => {
  render(<U1Viewer src="/models/none.glb" text={text} />);
  expect(await screen.findByText(text.unavailable)).toBeInTheDocument();
  expect(screen.queryByLabelText("Exploded view")).toBeNull();
});
