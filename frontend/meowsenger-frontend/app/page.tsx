"use client";
import { Snippet } from "@heroui/snippet";

import { title, subtitle } from "@/components/primitives";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import Container from "@/components/elements/container";
import { ProtectedRoute } from "@/components/elements/protected-route";
import { useLanguage } from "@/contexts/language-context";

export default function Home() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <ProtectedRoute authRedirect={true}>
      <Container>
        <div className="inline-block max-w-xl text-center justify-center">
          <span className={title()}>{t("home_title").split(" ")[0] + " "}</span>
          <br />
          <span className={title({ color: "green" })}>meowsenger</span>
          <br />
          <span className={title()}>
            {t("home_title").split(" ").slice(2).join(" ")}
          </span>
          <div className={subtitle({ class: "mt-4" })}>
            {t("home_subtitle")}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 items-center">
          <Snippet hideCopyButton hideSymbol variant="bordered">
            <span>
              {t("start_messaging")}{" "}
              <Button
                as={Link}
                href={ROUTES.signup}
                variant="flat"
                color="danger"
              >
                {t("signing_up")}
              </Button>
            </span>
          </Snippet>
          <div className="text-sm text-neutral-500">
            {t("already_have_account")}{" "}
            <Button
              size="sm"
              as={Link}
              href={ROUTES.login}
              variant="flat"
              color="success"
            >
              {t("login")}
            </Button>
          </div>
        </div>
      </Container>
    </ProtectedRoute>
  );
}
