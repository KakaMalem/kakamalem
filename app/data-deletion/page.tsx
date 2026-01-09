import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Kaka Malem",
  description:
    "Instructions for requesting deletion of your personal data from Kaka Malem",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-8 text-3xl font-bold">Data Deletion Instructions</h1>

        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">
              How to Delete Your Data
            </h2>
            <p>
              If you want to delete your personal data from Kaka Malem, you can
              do so by following these steps:
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Option 1: Delete from your account settings
            </h3>
            <ol className="list-inside list-decimal space-y-2 pl-4">
              <li>Log in to your Kaka Malem account</li>
              <li>Go to your account settings</li>
              <li>Select &quot;Delete Account&quot;</li>
              <li>Confirm the deletion</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Option 2: Contact us directly
            </h3>
            <p>
              Send an email to{" "}
              <a
                href="mailto:support@kakamalem.com"
                className="text-primary underline"
              >
                support@kakamalem.com
              </a>{" "}
              with the subject line &quot;Data Deletion Request&quot; and
              include:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
              <li>Your registered email address</li>
              <li>Your full name</li>
              <li>
                Any additional information to help us identify your account
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              What data will be deleted
            </h3>
            <p>Upon request, we will delete:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
              <li>Your profile information</li>
              <li>Your account credentials</li>
              <li>Any stores you own (if applicable)</li>
              <li>Associated media and uploaded files</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Processing time
            </h3>
            <p>
              We will process your data deletion request within 30 days. You
              will receive a confirmation email once your data has been deleted.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Facebook Login Users
            </h3>
            <p>
              If you signed up using Facebook, you can also remove Kaka Malem
              from your Facebook settings:
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-2 pl-4">
              <li>Go to your Facebook Settings &amp; Privacy → Settings</li>
              <li>Click on Apps and Websites</li>
              <li>Find Kaka Malem and click Remove</li>
              <li>
                Then follow the steps above to delete your data from our systems
              </li>
            </ol>
          </section>

          <section className="border-t pt-6">
            <p className="text-sm">
              If you have any questions about data deletion, please contact us
              at{" "}
              <a
                href="mailto:support@kakamalem.com"
                className="text-primary underline"
              >
                support@kakamalem.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
