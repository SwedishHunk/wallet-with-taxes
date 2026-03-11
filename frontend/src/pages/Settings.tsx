import { Page, PageHeader, Card } from "../components/ui/index";
import { useLanguage } from "../lib/LanguageContext";

export default function Settings() {
  const { t } = useLanguage();
  return (
    <Page>
      <PageHeader title={t("settings.title")} />
      <Card>
        <p>{t("settings.comingSoon")}</p>
      </Card>
    </Page>
  );
}
