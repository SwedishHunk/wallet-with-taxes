import { useState, useEffect } from "react";
import { useAuth } from "../lib/useAuth";
import { api } from "../lib/api";
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
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
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

  const canManageMembers =
    currentMember?.isOwner ||
    currentMember?.permissions.includes("ManageMembers");

  useEffect(() => {
    if (!isAuthenticated || !studioSession) return;
    fetchMembers();
  }, [studioSession]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(
        `/studios/${studioSession?.studioId}/members`,
      );
      setMembers(data);
      setError("");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load members"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      setError("Email is required");
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

      await api.post(
        `/studios/${studioSession?.studioId}/members`,
        payload,
      );

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
      await fetchMembers();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create member"
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <Page>
        <Card>Not authenticated</Card>
      </Page>
    );
  }

  if (!canManageMembers) {
    return (
      <Page>
        <Card>
          <p>You don't have permission to manage members.</p>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Hantera medlemmar"
        subtitle={`Studio: ${currentStudio?.studioName}`}
      >
        {!showForm ? (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Lägg till medlem
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setShowForm(false)}>
            Avbryt
          </Button>
        )}
      </PageHeader>

      {error && (
        <Card className="members-error">
          <p>{error}</p>
        </Card>
      )}

      {showForm && (
        <Card>
          <h3>Skapa ny medlem</h3>
          <form onSubmit={handleSubmit} className="members-form">
            <div className="members-form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="medlem@example.com"
                required
              />
            </div>

            <div className="members-form-group">
              <label>Lösenord (frivilligt, genereras om tomlt)</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Lämna tomt för slumpmässigt lösenord"
              />
            </div>

            <div className="members-form-group">
              <label>Behörigheter</label>
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
              Skapa medlem
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Card>Laddar medlemmar...</Card>
      ) : members.length === 0 ? (
        <Card>Ingen medlemmar ännu</Card>
      ) : (
        <div className="members-list-container">
          {members.map((member) => (
            <Card key={member.id} className="members-item">
              <div className="members-item-header">
                <div>
                  <p className="members-item-email">{member.email}</p>
                  <div className="members-item-badges">
                    {member.isOwner && (
                      <Badge variant="owner">Ägare</Badge>
                    )}
                    {!member.isOwner && member.permissions.length > 0 && (
                      member.permissions.map((p) => (
                        <Badge key={p} variant="permission">
                          {p}
                        </Badge>
                      ))
                    )}
                    {!member.isOwner && member.permissions.length === 0 && (
                      <Badge>Läsåtkomst</Badge>
                    )}
                  </div>
                </div>
                <small className="members-item-date">
                  {new Date(member.createdAt).toLocaleDateString("sv-SE")}
                </small>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
