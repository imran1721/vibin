import type { Metadata } from "next";
import {
  LegalDocLayout,
  LegalP,
  LegalSection,
  LegalUl,
} from "@/components/LegalDocLayout";

export const metadata: Metadata = {
  title: "Terms of Service — vibin.click",
  description: "Terms for using the vibin.click YouTube watch party app.",
};

export default function TermsPage() {
  return (
    <LegalDocLayout
      title="Terms of Service"
      intro="By using vibin.click, you agree to these terms. Last updated: April 2026. If you do not agree, do not use the service. vibin.click is provided by the operator of the website you are visiting."
    >
      <LegalSection title="The service">
        <LegalP>
          vibin.click provides tools to host synchronized YouTube playback in a shared
          “room” and to queue videos with others. Features may change at any time.
          The service is provided “as is” without warranties of any kind.
        </LegalP>
      </LegalSection>

      <LegalSection title="Eligibility and acceptable use">
        <LegalP>You agree to use vibin.click only in compliance with applicable law.</LegalP>
        <LegalUl>
          <li>
            Do not use the service to harass others, share unlawful content, or
            circumvent technical limits.
          </li>
          <li>
            You are responsible for content you add to the queue and for
            complying with YouTube’s Terms of Service and the rights of content
            owners.
          </li>
          <li>
            Optional Google/YouTube connection is subject to Google’s terms; you
            revoke access through your Google account if needed.
          </li>
        </LegalUl>
      </LegalSection>

      <LegalSection title="Third-party content">
        <LegalP>
          Videos and metadata come from YouTube and third parties. vibin.click does not
          own that content. Playback and availability depend on YouTube and
          rightsholders.
        </LegalP>
      </LegalSection>

      <LegalSection title="Accounts and sessions">
        <LegalP>
          Access may use anonymous or other accounts managed by our auth provider.
          You are responsible for activity under your session. We may suspend or
          limit access to protect the service or other users.
        </LegalP>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <LegalP>
          To the fullest extent permitted by law, we disclaim all warranties,
          express or implied, including merchantability, fitness for a particular
          purpose, and non-infringement. We do not guarantee uninterrupted or
          error-free operation.
        </LegalP>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <LegalP>
          To the fullest extent permitted by law, the operator of this deployment
          shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of profits or data,
          arising from your use of vibin.click. Our total liability for any claim
          relating to the service shall not exceed the greater of one hundred
          dollars (USD) or the amount you paid us to use the service in the
          twelve months before the claim (if any).
        </LegalP>
      </LegalSection>

      <LegalSection title="Indemnity">
        <LegalP>
          You agree to indemnify and hold harmless the operator from claims
          arising out of your use of the service or violation of these terms,
          where permitted by law.
        </LegalP>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalP>
          We may modify these terms or the service. Material changes may be posted
          on this page. Continued use after changes constitutes acceptance.
        </LegalP>
      </LegalSection>

      <LegalSection title="Governing law">
        <LegalP>
          Unless a different law applies where you live and cannot be waived, any
          dispute will be governed by the laws of the jurisdiction chosen by the
          site operator, without regard to conflict-of-law rules.
        </LegalP>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalP>
          For questions about these terms for a specific deployment, contact the
          operator of that website.
        </LegalP>
      </LegalSection>
    </LegalDocLayout>
  );
}
