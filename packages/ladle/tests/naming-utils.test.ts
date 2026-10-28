import { test, expect } from "vitest";
import {
  kebabCase,
  getEncodedStoryName,
} from "../lib/cli/vite-plugin/naming-utils.js";

test("kebabCase", () => {
  expect(kebabCase("ChampsÉlysées")).toBe("champs-élysées");
  expect(kebabCase("our-animals--mammals")).toBe("our-animals--mammals");
  expect(kebabCase("the quick brown fox")).toBe("the-quick-brown-fox");
  expect(kebabCase("the-quick-brown-fox")).toBe("the-quick-brown-fox");
  expect(kebabCase("the_quick_brown_fox")).toBe("the-quick-brown-fox");
  expect(kebabCase("theQuickBrownFox")).toBe("the-quick-brown-fox");
  expect(kebabCase("thequickbrownfox")).toBe("thequickbrownfox");
  expect(kebabCase("theQUICKBrownFox")).toBe("the-quick-brown-fox");
});

test("getEncodedStoryName prefixes identifier when starting with a digit", () => {
  expect(getEncodedStoryName("00-primitives", "reach-balance")).toBe(
    "_00$primitives$$reach$balance",
  );
  expect(getEncodedStoryName("01-button", "primary")).toBe(
    "_01$button$$primary",
  );
  expect(getEncodedStoryName("animals", "cat")).toBe("animals$$cat");
});
