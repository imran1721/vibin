import type { Metadata } from "next";
import {
  LegalDocLayout,
  LegalP,
  LegalSection,
  LegalUl,
} from "@/components/LegalDocLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — vibin.click",
  description:
    "How vibin.click handles information when you host or join YouTube listening parties.",
};

export default function PrivacyPage() {
  return (
    <LegalDocLayout
      title="Privacy Policy"
      intro='This policy describes how vibin.click ("we", "the service") handles information when you use the app. Last updated: April 2026. If you run your own copy of vibin.click, the operator of that deployment is responsible for how data is processed.'
    >
      <LegalSection title="About vibin.click">
        <LegalP>
          vibin.click is a web app for shared YouTube playback: a host runs playback in
          a room while others can search, queue videos, and (when enabled) connect
          their YouTube account to add from playlists.
        </LegalP>
      </LegalSection>

      <LegalSection title="Information we process">
        <LegalP>Depending on how you use the app, this may include:</LegalP>
        <LegalUl>
          <li>
            <strong className="text-foreground">Account data.</strong> We use
            Supabase Auth with anonymous sign-in so you can join rooms without a
            password. That creates a technical user id on our backend.
          </li>
          <li>
            <strong className="text-foreground">Room activity.</strong> Data
            such as room membership, queue items, playback state, optional
            display names you choose, and related timestamps may be stored to
            operate the session.
          </li>
          <li>
            <strong className="text-foreground">Device storage.</strong> Your
            browser may store preferences (for example display name choice or UI
            settings) in local or session storage on your device.
          </li>
          <li>
            <strong className="text-foreground">YouTube / Google.</strong> If you
            connect Google to import playlists, Google’s authentication and
            YouTube APIs apply; we only use that access to provide playlist
            features you trigger in the app.
          </li>
          <li>
            <strong className="text-foreground">Analytics.</strong> We may use
            lightweight analytics to understand usage (for example session
            events). Details depend on how this deployment is configured.
          </li>
        </LegalUl>
      </LegalSection>

      <LegalSection title="How we use information">
        <LegalP>
          We use the above to run rooms (sync queue and playback), show optional
          social context (such as who added a track or who is listed as a guest),
          improve reliability, and secure the service. We do not sell your
          personal information.
        </LegalP>
      </LegalSection>

      <LegalSection title="Service providers">
        <LegalP>
          The app relies on infrastructure and vendors such as Supabase (database
          and auth), hosting providers, and optionally Google/YouTube. Their
          privacy policies govern how they process data on their systems.
        </LegalP>
      </LegalSection>

      <LegalSection title="Retention">
        <LegalP>
          Data is kept as long as needed to operate the service and as required
          by backups or law. Room and queue data may be removed when rooms are
          deleted or pruned according to server configuration.
        </LegalP>
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalP>
          You can clear site data in your browser to remove locally stored
          preferences. Leaving a room or signing out (where available) limits
          further association with that session. For data held on the server,
          contact the operator of the site you use.
        </LegalP>
      </LegalSection>

      <LegalSection title="Children">
        <LegalP>
          The service is not directed at children under 13. If you believe we have
          collected a child’s information in error, contact the site operator.
        </LegalP>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalP>
          We may update this policy from time to time. Continued use after changes
          means you accept the updated policy.
        </LegalP>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalP>
          For privacy questions about a specific deployment of vibin.click, contact the
          person or organization operating that website.
        </LegalP>
      </LegalSection>
    </LegalDocLayout>
  );
}
