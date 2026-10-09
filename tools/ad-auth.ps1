# يتحقق من اسم المستخدم وكلمة المرور على الدومين ويُرجع بيانات المستخدم كـ JSON (سطر واحد).
# الإدخال (stdin): {"domain":"","username":"sara","password":"..."}
# يعمل على Windows PowerShell 5.1 ويحتاج أن يكون السيرفر منضمّاً للدومين.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Out-Json($o) { Write-Output ($o | ConvertTo-Json -Compress -Depth 4) }
try {
  $raw = [Console]::In.ReadToEnd()
  $in  = $raw | ConvertFrom-Json
  Add-Type -AssemblyName System.DirectoryServices.AccountManagement
  $ct = [System.DirectoryServices.AccountManagement.ContextType]::Domain
  if ([string]::IsNullOrWhiteSpace($in.domain)) { $ctx = New-Object System.DirectoryServices.AccountManagement.PrincipalContext($ct) }
  else { $ctx = New-Object System.DirectoryServices.AccountManagement.PrincipalContext($ct, $in.domain) }

  if (-not $ctx.ValidateCredentials($in.username, $in.password)) { Out-Json @{ ok = $false }; exit 0 }

  $u = [System.DirectoryServices.AccountManagement.UserPrincipal]::FindByIdentity($ctx, $in.username)
  if ($null -eq $u) { Out-Json @{ ok = $false }; exit 0 }
  $de = $u.GetUnderlyingObject()
  $mgrSam = $null
  $mgrDn = $de.Properties['manager'].Value
  if ($mgrDn) { try { $m = [ADSI]("LDAP://" + $mgrDn); $mgrSam = [string]$m.Properties['samaccountname'].Value } catch { } }
  $groups = @()
  try { $groups = @($u.GetGroups() | ForEach-Object { $_.SamAccountName }) } catch { }
  Out-Json @{
    ok = $true; username = $u.SamAccountName; name = $u.DisplayName; email = $u.EmailAddress; enabled = [bool]$u.Enabled
    department = [string]$de.Properties['department'].Value; title = [string]$de.Properties['title'].Value
    manager = $mgrSam; groups = $groups
  }
} catch {
  Out-Json @{ ok = $false; error = $_.Exception.Message }
}
