param(
    [string]$WebProject = "D:\NewCityStyleApp\new-city-style"
)

$path = Join-Path $WebProject "app\admin\orders\page.tsx"

if (!(Test-Path $path)) {
    throw "Admin orders page not found: $path"
}

$content = Get-Content $path -Raw

if ($content.Contains("NCS_NATIVE_ORDER_PUSH_WEB_ADMIN")) {
    Write-Host "Web Admin native order push hook already present."
    exit 0
}

$needle = @'
      if (error) throw error;

      setOrders((current) =>
'@

$replacement = @'
      if (error) throw error;

      // NCS_NATIVE_ORDER_PUSH_WEB_ADMIN
      // Best-effort only: never roll back a real order status update.
      try {
        const nativePushResponse = await fetch(
          "/api/push/order-status",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: order.id,
              status: newStatus,
            }),
          }
        );

        if (!nativePushResponse.ok) {
          console.warn(
            "Native order push returned HTTP",
            nativePushResponse.status
          );
        }
      } catch (nativePushError) {
        console.warn(
          "Native order push failed after status update:",
          nativePushError
        );
      }

      setOrders((current) =>
'@

$index = $content.IndexOf($needle)

if ($index -lt 0) {
    throw "Safe patch point was not found. File was NOT modified."
}

$content =
    $content.Substring(0, $index) +
    $replacement +
    $content.Substring($index + $needle.Length)

Set-Content $path $content -Encoding UTF8

Write-Host "SUCCESS: Web Admin order-status native push hook added."
