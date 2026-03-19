import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "../lib/AuthContext";
import { getGames, createGame } from "../lib/platform";
import { ROUTES } from "../routes";
import { useLanguage } from "../lib/LanguageContext";
import { Page, PageHeader, Card, Button, Badge } from "../components/ui/index";

interface Game {
  gameId: string;
  name: string;
  slug: string;
}

export default function Games() {
  const navigate = useNavigate();
  const { activeGame, setActiveGame } = useAuthState();
  const { t } = useLanguage();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGameName, setNewGameName] = useState("");
  const [newGameSlug, setNewGameSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const visibleActiveGame =
    activeGame && games.some((game) => game.gameId === activeGame.gameId)
      ? activeGame
      : null;

  useEffect(() => {
    if (activeGame && !loading && !visibleActiveGame) {
      setActiveGame(null);
    }
  }, [activeGame, loading, visibleActiveGame, setActiveGame]);

  useEffect(() => {
    loadGames();
  }, []);

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const loadGames = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getGames();
      // Map backend format (id) to frontend format (gameId)
      const mappedGames = (response.data || []).map(
        (game: { id: string; name: string; slug: string }) => ({
          gameId: game.id,
          name: game.name,
          slug: game.slug,
        })
      );
      setGames(mappedGames);
    } catch (err: unknown) {
      console.error("Failed to load games:", err);
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("games.errLoadFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = (game: Game) => {
    setActiveGame({
      gameId: game.gameId,
      name: game.name,
      slug: game.slug,
    });
    navigate(ROUTES.dashboard);
  };

  const handleOpenTrade = (game: Game) => {
    navigate(`/player/game/${game.gameId}/trade`);
  };

  const handleManageNFTs = (game: Game) => {
    navigate(ROUTES.nftManagement(game.gameId));
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) {
      return;
    }

    // Use manual slug if provided, otherwise auto-generate from name
    const slug = newGameSlug.trim() || generateSlug(newGameName);
    if (!slug) {
      setError(t("games.errNameAlphanumeric"));
      return;
    }

    // Check for duplicate name or slug
    const duplicateName = games.find(
      (g) => g.name.toLowerCase() === newGameName.trim().toLowerCase(),
    );
    const duplicateSlug = games.find((g) => g.slug === slug);

    if (duplicateName) {
      setError(`${t("games.errDupNamePre")} "${newGameName.trim()}" ${t("games.errAlreadyExists")}`);
      return;
    }

    if (duplicateSlug) {
      setError(`${t("games.errDupSlugPre")} "${slug}" ${t("games.errAlreadyExists")}`);
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await createGame({
        name: newGameName.trim(),
        slug: slug,
      });
      setNewGameName("");
      setNewGameSlug("");
      setShowCreateForm(false);
      await loadGames();
    } catch (err: unknown) {
      console.error("Failed to create game:", err);
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("games.errCreateFailed")
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title={t("games.title")}
        subtitle={t("games.subtitle")}
      />

      {visibleActiveGame && (
        <Card>
          <div style={{ marginBottom: "1rem" }}>
            <strong>{t("games.activeGame")}:</strong> {visibleActiveGame.name}{" "}
            <Badge variant="permission">{visibleActiveGame.slug}</Badge>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onClick={() => setActiveGame(null)}
              style={{ marginRight: "0.5rem" }}>
              {t("games.clearActive")}
            </Button>
            <Button onClick={() => handleOpenTrade(visibleActiveGame)}>
              Open Trade
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <Card>
          <p style={{ color: "var(--error, red)" }}>{error}</p>
        </Card>
      )}

      {loading ? (
        <Card>
          <p>{t("games.loading")}</p>
        </Card>
      ) : (
        <>
          {games.length === 0 ? (
            <Card>
              <p>{t("games.noGamesYet")}</p>
            </Card>
          ) : (
            <Card>
              <h3 style={{ marginTop: 0 }}>{t("games.available")}</h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}>
                {games.map((game) => (
                  <div
                    key={game.gameId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      border: "1px solid var(--border, #ccc)",
                      borderRadius: "4px",
                      backgroundColor:
                        visibleActiveGame?.gameId === game.gameId
                          ? "var(--primary-light, #e3f2fd)"
                          : "transparent",
                    }}>
                    <div>
                      <strong>{game.name}</strong>
                      <div style={{ fontSize: "0.875rem", color: "#666" }}>
                        Slug: {game.slug} | ID: {game.gameId}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <Button onClick={() => handleOpenTrade(game)}>
                        Open Trade
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleManageNFTs(game)}>
                        Manage NFTs
                      </Button>
                      <Button
                        onClick={() => handleSetActive(game)}
                        disabled={visibleActiveGame?.gameId === game.gameId}>
                        {visibleActiveGame?.gameId === game.gameId
                          ? t("games.active")
                          : t("games.setActive")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            {!showCreateForm ? (
              <Button onClick={() => setShowCreateForm(true)}>
                {t("games.createNewBtn")}
              </Button>
            ) : (
              <form onSubmit={handleCreateGame}>
                <h3 style={{ marginTop: 0 }}>{t("games.createNewTitle")}</h3>
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    htmlFor="gameName"
                    style={{ display: "block", marginBottom: "0.25rem" }}>
                    {t("games.nameLabel")}
                  </label>
                  <input
                    id="gameName"
                    type="text"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    placeholder="Ex: My Awesome Game"
                    required
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid var(--border, #ccc)",
                      borderRadius: "4px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    htmlFor="gameSlug"
                    style={{ display: "block", marginBottom: "0.25rem" }}>
                    {t("games.slugLabel")}
                  </label>
                  <input
                    id="gameSlug"
                    type="text"
                    value={newGameSlug}
                    onChange={(e) => setNewGameSlug(e.target.value)}
                    placeholder={t("games.slugPlaceholder")}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid var(--border, #ccc)",
                      borderRadius: "4px",
                      fontSize: "1rem",
                    }}
                  />
                  {!newGameSlug && newGameName && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.875rem",
                        color: "#666",
                      }}>
                      {t("games.slugAuto")}{" "}
                      <strong>{generateSlug(newGameName)}</strong>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button type="submit" disabled={creating}>
                    {creating ? t("games.creating") : t("games.createBtn")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewGameName("");
                      setNewGameSlug("");
                      setError(null);
                    }}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
