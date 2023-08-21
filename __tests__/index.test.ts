import doStuff from "../index";

describe("my function", () => {
  let value = doStuff();

  it("should return null", () => {
    expect(value).toBe(null);
  });
  
  it("should be a falsey value", () => {
    expect(value).toBeFalsy();
  });

  it("should be defined", () => {
    expect(value).toBeDefined();
  });
});
