import { test, expect } from "vitest";
import {
  kebabCase,
  getEncodedStoryName,
  titleToFileId,
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
  expect(kebabCase("Door: Left Hand")).toBe("door-left-hand");
  expect(kebabCase("Button - Primary")).toBe("button-primary");
  expect(kebabCase("Door: Left — Hand")).toBe("door-left-hand");
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

test("titleToFileId splits on default and custom delimiters without splitting on punctuation", () => {
  expect(titleToFileId("Forms / Inputs / Text")).toBe("forms--inputs--text");
  expect(titleToFileId("Door: Left Hand")).toBe("door:-left-hand");
  expect(titleToFileId("Forms.Inputs.Text", ".")).toBe("forms--inputs--text");
  expect(titleToFileId("Forms | Inputs | Text", "|")).toBe(
    "forms--inputs--text",
  );
});
