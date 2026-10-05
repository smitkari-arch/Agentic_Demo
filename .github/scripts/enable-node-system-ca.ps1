$existingUser = [Environment]::GetEnvironmentVariable('NODE_OPTIONS', 'User')
$desired = '--use-system-ca'
$combined = if ([string]::IsNullOrWhiteSpace($existingUser)) {
    $desired
} elseif ($existingUser -split ' ' | Where-Object { $_ -match '--use-system-ca' }) {
    $existingUser
} else {
    "$existingUser $desired"
}

[Environment]::SetEnvironmentVariable('NODE_OPTIONS', $combined, 'User')
[Environment]::SetEnvironmentVariable('NODE_OPTIONS', $combined, 'Process')

Write-Host "NODE_OPTIONS set to: $combined"
