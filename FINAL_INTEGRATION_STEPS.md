# Campaign Page - Final Integration Steps

The tooltip component is now installed and ready. Here's the absolute minimal changes needed:

## Step 1: Add Handler Functions

**Location**: Around line 900, after the other handler functions

```typescript
const handleImportSuccess = (campaignId: string) => {
  toast.success('Campaign imported successfully!');
  setShowImportDialog(false);
  router.refresh();
};

const handleLaunchSuccess = () => {
  toast.success('Campaign launched to PlusVibe!');
  setShowLaunchDialog(false);
  router.refresh();
};
```

## Step 2: Add Dialog Components  

**Location**: Before the closing `</DashboardLayout>` tag (around line 2393)

Find this line:
```tsx
        </div>
      </DashboardLayout>
    );
```

Change it to:
```tsx
        </div>

        {/* PlusVibe Integration Dialogs */}
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
      </DashboardLayout>
    );
```

##  That's It!

The imports and state areALREADY DONE from earlier successful edits:
- ✅ Imports added (lines 62-64)
- ✅ State variables added (line 294-295)

Just add those 2 small code blocks above and you're done!

## Quick Test

After adding, you can test by:
1. Click Settings button
2. The dialogs won't appear yet (need to wire to UI)
3. But no TypeScript errors should show

##Optional: Add Buttons to Settings Dialog

If you want buttons to trigger the dialogs, add this in the settings dialog (around line 2195):

```tsx
<Button
  variant="outline"
  className="w-full justify-start"
  onClick={() => setShowImportDialog(true)}
>
  <Download className="h-4 w-4 mr-2" />
  Import from PlusVibe
</Button>

<Button
  variant="outline"
  className="w-full justify-start"  
  onClick={() => setShowLaunchDialog(true)}
>
  <Upload className="h-4 w-4 mr-2" />
  Launch to PlusVibe
</Button>
```
