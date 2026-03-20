import { useState, useEffect } from "react";
import { useAuth } from "../lib/useAuth";
import { useLanguage } from "../lib/LanguageContext";
import {
  getStudioMembers,
  createStudioMember,
  updateStudioMember,
  deleteStudioMember,
  devSeedMembers,
} from "../lib/users";
import { Page, PageHeader, Card, Button, Badge } from "../components/ui/index";
import "../style/Members.css";

interface Member {
  id: string;
  userId: string;
  email: string;
  isOwner: boolean;
  role: string;
  permissions: string[];
  gameAccessIds: string[];
  createdAt: string;
}

export default function Members() {
  const { currentStudio, currentMember, isAuthenticated, studioSession } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    permissions: {
      ManageMembers: false,
      ManageGames: false,
      ManageSettings: false,
      MintNFT: false,
      MakeTransactions: false,
    },
  });
  const [editPermissions, setEditPermissions] = useState({
    ManageMembers: false,
    ManageGames: false,
    ManageSettings: false,
    MintNFT: false,
    MakeTransactions: false,
  });

  const canManageMembers =
    currentMember?.isOwner ||
    currentMember?.permissions.includes("ManageMembers");

  useEffect(() => {
    if (!isAuthenticated || !studioSession) return;
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioSession]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data } = await getStudioMembers(studioSession!.studioId);
      setMembers(data);
      setError("");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("members.errLoadFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      setError(t("members.errEmailRequired"));
      return;
    }

    try {
      const permissionsList = Object.entries(formData.permissions)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const payload: {
        email: string;
        permissions: string[];
        password?: string;
      } = {
        email: formData.email,
        permissions: permissionsList,
      };

      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      await createStudioMember(studioSession!.studioId, payload);

      setFormData({
        email: "",
        password: "",
        permissions: {
          ManageMembers: false,
          ManageGames: false,
          ManageSettings: false,
          MintNFT: false,
          MakeTransactions: false,
        },
      });
      setShowForm(false);
      setError("");
      setMessage("Member created");
      await fetchMembers();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("members.errCreateFailed")
      );
    }
  };

  const startEditing = (member: Member) => {
    setEditingMemberId(member.id);
    setEditPermissions({
      ManageMembers: member.permissions.includes("ManageMembers"),
      ManageGames: member.permissions.includes("ManageGames"),
      ManageSettings: member.permissions.includes("ManageSettings"),
      MintNFT: member.permissions.includes("MintNFT"),
      MakeTransactions: member.permissions.includes("MakeTransactions"),
    });
    setError("");
    setMessage("");
  };

  const cancelEditing = () => {
    setEditingMemberId(null);
    setError("");
  };

  const saveMemberPermissions = async (member: Member) => {
    if (!studioSession) return;

    try {
      setActionLoading(`save:${member.id}`);
      const permissions = Object.entries(editPermissions)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);

      await updateStudioMember(studioSession.studioId, member.id, {
        role: member.role,
        permissions,
      });

      setEditingMemberId(null);
      setError("");
      setMessage("Permissions updated");
      await fetchMembers();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not update member permissions",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (!studioSession) return;

    const confirmed = window.confirm(`Remove ${member.email} from this studio?`);
    if (!confirmed) return;

    try {
      setActionLoading(`delete:${member.id}`);
      await deleteStudioMember(studioSession.studioId, member.id);
      setError("");
      setMessage("Member removed");
      await fetchMembers();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not delete member",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedMembers = async (count: number) => {
    if (!studioSession) return;

    try {
      setActionLoading(`seed:${count}`);
      setError("");
      const { data } = await devSeedMembers({
        studioId: studioSession.studioId,
        count,
      });
      setMessage(`Created ${data.count} test members`);
      await fetchMembers();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed test members",
      );
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <Page>
        <Card>{t("members.notAuth")}</Card>
      </Page>
    );
  }

  if (!canManageMembers) {
    return (
      <Page>
        <Card>
          <p>{t("members.noPermission")}</p>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t("members.manage")}
        subtitle={`Studio: ${currentStudio?.studioName}`}
      >
        {!showForm ? (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            {t("members.addMember")}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setShowForm(false)}>
            {t("common.cancel")}
          </Button>
        )}
      </PageHeader>

      {error && (
        <Card className="members-error">
          <p>{error}</p>
        </Card>
      )}

      {message && (
        <Card className="members-success">
          <p>{message}</p>
        </Card>
      )}

      {import.meta.env.DEV && studioSession && (
        <Card>
          <div className="members-dev-tools">
            <div>
              <h3 className="members-dev-title">Dev member seeding</h3>
              <p className="members-dev-copy">
                Create random test members with mixed permissions to stress-test the
                list, actions, and layout.
              </p>
            </div>
            <div className="members-dev-actions">
              {[5, 10, 25].map((count) => (
                <Button
                  key={count}
                  variant="secondary"
                  onClick={() => handleSeedMembers(count)}
                  disabled={actionLoading === `seed:${count}`}
                >
                  {actionLoading === `seed:${count}`
                    ? `Seeding ${count}...`
                    : `Seed ${count}`}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showForm && (
        <Card>
          <h3>{t("members.createNew")}</h3>
          <form onSubmit={handleSubmit} className="members-form">
            <div className="members-form-group">
              <label>{t("members.emailLabel")}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="member@example.com"
                required
              />
            </div>

            <div className="members-form-group">
              <label>{t("members.passwordOptional")}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Leave blank for a random password"
              />
            </div>

            <div className="members-form-group">
              <label>{t("members.permissions")}</label>
              <div className="members-permissions-grid">
                {Object.entries(formData.permissions).map(([perm, checked]) => (
                  <div key={perm} className="members-permission-checkbox">
                    <input
                      type="checkbox"
                      id={perm}
                      checked={checked}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: {
                            ...formData.permissions,
                            [perm]: e.target.checked,
                          },
                        })
                      }
                    />
                    <label htmlFor={perm}>{perm}</label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" variant="primary">
              {t("members.createBtn")}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Card>{t("members.loading")}</Card>
      ) : members.length === 0 ? (
        <Card>{t("members.noMembers")}</Card>
      ) : (
        <div className="members-list-container">
          {members.map((member) => (
            <Card key={member.id} className="members-item">
              <div className="members-item-header">
                <div>
                  <p className="members-item-email">{member.email}</p>
                  <div className="members-item-badges">
                    {member.isOwner && (
                      <Badge variant="owner">{t("common.owner")}</Badge>
                    )}
                    {!member.isOwner &&
                      editingMemberId !== member.id &&
                      member.permissions.length > 0 &&
                      member.permissions.map((p) => (
                        <Badge key={p} variant="permission">
                          {p}
                        </Badge>
                      ))}
                    {!member.isOwner &&
                      editingMemberId !== member.id &&
                      member.permissions.length === 0 && (
                      <Badge>{t("members.readOnly")}</Badge>
                    )}
                  </div>
                </div>
                <div className="members-item-side">
                  <small className="members-item-date">
                    {new Date(member.createdAt).toLocaleDateString("en-US")}
                  </small>
                  {!member.isOwner && (
                    <div className="members-item-actions">
                      {editingMemberId === member.id ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => cancelEditing()}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => saveMemberPermissions(member)}
                            disabled={actionLoading === `save:${member.id}`}
                          >
                            {actionLoading === `save:${member.id}` ? "Saving..." : "Save"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => startEditing(member)}
                          >
                            Edit permissions
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleDeleteMember(member)}
                            disabled={actionLoading === `delete:${member.id}`}
                          >
                            {actionLoading === `delete:${member.id}` ? "Removing..." : "Remove"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {!member.isOwner && editingMemberId === member.id && (
                <div className="members-edit-panel">
                  <p className="members-edit-title">Permissions</p>
                  <div className="members-permissions-grid">
                    {Object.entries(editPermissions).map(([perm, checked]) => (
                      <div key={perm} className="members-permission-checkbox">
                        <input
                          type="checkbox"
                          id={`edit-${member.id}-${perm}`}
                          checked={checked}
                          onChange={(e) =>
                            setEditPermissions({
                              ...editPermissions,
                              [perm]: e.target.checked,
                            })
                          }
                        />
                        <label htmlFor={`edit-${member.id}-${perm}`}>{perm}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
