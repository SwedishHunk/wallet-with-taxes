import { StudiosController } from "./studios.controller";

function req(user: { id: string }) {
  return { user } as never;
}

describe("StudiosController", () => {
  it("delegates getMembers with studio and actor user id", async () => {
    const service = {
      getStudioMembers: jest.fn().mockResolvedValue([]),
      createMember: jest.fn(),
    };
    const controller = new StudiosController(service as never);

    await controller.getMembers(req({ id: "u1" }), "s1");
    expect(service.getStudioMembers).toHaveBeenCalledWith("s1", "u1");
  });

  it("delegates createMember and defaults permissions to empty list", async () => {
    const service = {
      getStudioMembers: jest.fn(),
      createMember: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new StudiosController(service as never);

    await controller.createMember(req({ id: "u1" }), "s1", {
      email: "user@example.com",
      role: "member",
    });
    expect(service.createMember).toHaveBeenCalledWith("s1", "u1", {
      email: "user@example.com",
      password: undefined,
      role: "member",
      permissions: [],
    });
  });
});
