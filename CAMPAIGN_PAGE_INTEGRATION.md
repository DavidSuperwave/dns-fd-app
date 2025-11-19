/**
 * Simplified Campaign Page Integration File
 * Add these imports and state to the campaign page
 */

// Add these imports at the top:
import { CampaignImportDialog } from '@/components/plusvibe/campaign-import-dialog';
import { CampaignLaunchDialog } from '@/components/plusvibe/campaign-launch-dialog';
import { CampaignSyncStatusBadge } from '@/components/plusvibe/sync-status';

// Add these state variables (around line 240):
const [showImportDialog, setShowImportDialog] = useState(false);
const [showLaunchDialog, setShowLaunchDialog] = useState(false);

// Add these handlers:
function handleImportSuccess(campaignId: string) {
  toast.success('Campaign imported successfully!');
  setShowImportDialog(false);
  router.refresh();
}

function handleLaunchSuccess() {
  toast.success('Campaign launched to PlusVibe!');
  setShowLaunchDialog(false);
  router.refresh();
}

// Replace the old Settings Dialog (lines 2145-2505) with this:
{/* New Modern Settings with Import/Launch */}
<Tabs defaultValue="settings" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="settings">Settings</TabsTrigger>
    <TabsTrigger value="import">Import Campaign</TabsTrigger>
    <TabsTrigger value="export">Launch to PlusVibe</TabsTrigger>
  </TabsList>

  <TabsContent value="settings" className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Company Report</CardTitle>
        <CardDescription>Regenerate the company report if needed</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            setIsRegenerating(true);
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));
              toast.success("Company report regeneration initiated");
              setShowSettings(false);
              router.push(`/projects/${projectId}/report`);
            } catch (error) {
              toast.error("Failed to regenerate report");
            } finally {
              setIsRegenerating(false);
            }
          }}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Regenerate Company Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>

    {/* Quick Actions */}
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setShowImportDialog(true)}
        >
          <Download className="h-4 w-4 mr-2" />
          Import PlusVibe Campaign
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setShowLaunchDialog(true)}
        >
          <Upload className="h-4 w-4 mr-2" />
          Launch Campaign to PlusVibe
        </Button>
      </CardContent>
    </Card>
  </TabsContent>

  <TabsContent value="import">
    <div className="p-4 text-center">
      <p className="text-sm text-muted-foreground mb-4">
        Import an existing PlusVibe campaign into this project
      </p>
      <Button onClick={() => setShowImportDialog(true)}>
        <Download className="h-4 w-4 mr-2" />
        Open Import Dialog
      </Button>
    </div>
  </TabsContent>

  <TabsContent value="export">
    <div className="p-4 text-center">
      <p className="text-sm text-muted-foreground mb-4">
        Export this campaign to PlusVibe
      </p>
      <Button onClick={() => setShowLaunchDialog(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Open Launch Dialog
      </Button>
    </div>
  </TabsContent>
</Tabs>

// Add these dialog components before the closing </DashboardLayout> tag:
<CampaignImportDialog
  projectId={projectId}
  open={showImportDialog}
  onOpenChange={setShowImportDialog}
  onSuccess={handleImportSuccess}
/>

<CampaignLaunchDialog
  campaignId={campaignId || ''}
  campaignName={projectName + ' Campaign'}
  open={showLaunchDialog}
  onOpenChange={setShowLaunchDialog}
  onSuccess={handleLaunchSuccess}
/>
