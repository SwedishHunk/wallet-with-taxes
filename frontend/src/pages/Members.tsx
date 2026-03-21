import { useState, useEffect } from "react";
import { useAuth } from "../lib/useAuth";
import { useLanguage } from "../lib/LanguageContext";
import {
  getStudioMembers,
  createStudioMember,
  updateStudioMember,
  deleteStudioMember,
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<
    "all" | "actionable" | "manageMembers" | "canTransact" | "readOnly"
  >("actionable");
  const [sortMode, setSortMode] = useState<
    "newest" | "oldest" | "alphabetical" | "permissionCount"
  >("newest");
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

  const filteredMembers = members
    .filter((member) => {
      const query = searchTerm.trim().toLowerCase();
      if (query && !member.email.toLowerCase().includes(query)) {
        return false;
      }

      switch (filterMode) {
        case "actionable":
          return !member.isOwner;
        case "manageMembers":
          return member.permissions.includes("ManageMembers");
        case "canTransact":
          return member.permissions.includes("MakeTransactions");
        case "readOnly":
          return !member.isOwner && member.permissions.length === 0;
        case "all":
        default:
          return true;
      }
    })
    .sort((a, b) => {
      const ownerBias =
        a.isOwner === b.isOwner ? 0 : a.isOwner ? 1 : -1;
      if (ownerBias !== 0) return ownerBias;

      switch (sortMode) {
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "alphabetical":
          return a.email.localeCompare(b.email);
        case "permissionCount":
          return b.permissions.length - a.permissions.length;
        case "newest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

  useEffect(() => {
    if (!isAuthenticated || !studioSession) return;
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioSession]);

  useEffect(() => {
    const refresh = () => {
      void fetchMembers();
    };

    window.addEventListener("devtools:members:refresh", refresh);
    return () => {
      window.removeEventListener("devtools:members:refresh", refresh);
    };
  }, []);

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
        <div className="members-header-actions">
          {!showForm ? (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              {t("members.addMember")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
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

      <div className="members-layout">
        <div className="members-main">
          <Card>
            <div className="members-toolbar">
              <div className="members-toolbar-search">
                <label htmlFor="members-search">Search members</label>
                <input
                  id="members-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by email"
                />
              </div>
              <div className="members-toolbar-selects">
                <div className="members-toolbar-field">
                  <label htmlFor="members-filter">Filter</label>
                  <select
                    id="members-filter"
                    value={filterMode}
                    onChange={(e) =>
                      setFilterMode(
                        e.target.value as
                          | "all"
                          | "actionable"
                          | "manageMembers"
                          | "canTransact"
                          | "readOnly",
                      )
                    }
                  >
                    <option value="actionable">Actionable members</option>
                    <option value="all">All members</option>
                    <option value="manageMembers">Can manage members</option>
                    <option value="canTransact">Can transact</option>
                    <option value="readOnly">Read-only</option>
                  </select>
                </div>
                <div className="members-toolbar-field">
                  <label htmlFor="members-sort">Sort</label>
                  <select
                    id="members-sort"
                    value={sortMode}
                    onChange={(e) =>
                      setSortMode(
                        e.target.value as
                          | "newest"
                          | "oldest"
                          | "alphabetical"
                          | "permissionCount",
                      )
                    }
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="alphabetical">A-Z</option>
                    <option value="permissionCount">Most permissions</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="members-toolbar-summary">
              Showing {filteredMembers.length} of {members.length} members
            </div>
          </Card>

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
          ) : filteredMembers.length === 0 ? (
            <Card>
              {members.length === 0
                ? t("members.noMembers")
                : "No members match the current search/filter."}
            </Card>
          ) : (
            <div className="members-list-container">
              {filteredMembers.map((member) => (
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
                                {actionLoading === `save:${member.id}`
                                  ? "Saving..."
                                  : "Save"}
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
                                {actionLoading === `delete:${member.id}`
                                  ? "Removing..."
                                  : "Remove"}
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
        </div>
      </div>
    </Page>
  );
}
