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
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
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

  it("delegates updateMember and defaults permissions to empty list", async () => {
    const service = {
      getStudioMembers: jest.fn(),
      createMember: jest.fn(),
      updateMember: jest.fn().mockResolvedValue({ ok: true }),
      deleteMember: jest.fn(),
    };
    const controller = new StudiosController(service as never);

    await controller.updateMember(req({ id: "u1" }), "s1", "m1", {
      role: "admin",
    });
    expect(service.updateMember).toHaveBeenCalledWith("s1", "u1", "m1", {
      role: "admin",
      permissions: [],
    });
  });

  it("delegates deleteMember", async () => {
    const service = {
      getStudioMembers: jest.fn(),
      createMember: jest.fn(),
      updateMember: jest.fn(),
      deleteMember: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new StudiosController(service as never);

    await controller.deleteMember(req({ id: "u1" }), "s1", "m1");
    expect(service.deleteMember).toHaveBeenCalledWith("s1", "u1", "m1");
  });
});
