import { describe, expect, it } from "vitest";
import { participantProofState, validateProofFiles } from "./proof-upload-state";

describe("browser proof upload", () => {
  it("accepts bounded screenshot types and multiple files", () => {
    expect(validateProofFiles([{ type: "image/png", size: 100 }, { type: "image/jpeg", size: 200 }])).toBe("ok");
  });
  it("rejects unsafe, oversized, empty, and excessive files", () => {
    expect(validateProofFiles([{ type: "image/svg+xml", size: 100 }])).toBe("unsupported");
    expect(validateProofFiles([{ type: "image/png", size: 0 }])).toBe("invalid_size");
    expect(validateProofFiles([{ type: "image/png", size: 20_971_521 }])).toBe("invalid_size");
    expect(validateProofFiles([{ type: "image/png", size: 1 }], 5)).toBe("too_many");
  });
  it("maps internal proof states to participant-safe states", () => {
    expect(participantProofState("queued")).toBe("verifying");
    expect(participantProofState("fraudulent")).toBe("suspicious");
    expect(participantProofState("unknown")).toBe("operational_error");
  });
});
