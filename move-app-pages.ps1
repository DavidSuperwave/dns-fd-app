# Create (app) directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "src/app/(app)"

# Move app pages to (app) directory
$pages = @(
    "dashboard",
    "dns-records",
    "domains",
    "login",
    "settings",
    "signup",
    "users"
)

foreach ($page in $pages) {
    if (Test-Path "src/app/$page") {
        Move-Item -Path "src/app/$page" -Destination "src/app/(app)/$page" -Force
    }
}

# Move page.tsx if it exists (but not api or layout files)
if (Test-Path "src/app/page.tsx") {
    Move-Item -Path "src/app/page.tsx" -Destination "src/app/(app)/page.tsx" -Force
}