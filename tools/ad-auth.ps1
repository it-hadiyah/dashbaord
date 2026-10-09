# Verifies a domain username/password against Active Directory (LDAP bind) and prints one JSON line.
# stdin : {"domain":"hadiyah.org.sa","server":"10.10.10.201","username":"sara","password":"..."}
# stdout: {"ok":true,"username":..,"name":..,"email":..,"department":..,"title":..,"manager":..,"groups":[..],"enabled":true}
#         {"ok":false}                        -> wrong username/password (or locked/disabled account)
#         {"ok":false,"error":"..."}          -> the domain could not be reached / script error
# Works with Windows PowerShell 5.1. Uses LDAP simple/negotiate bind, so it also works with an IP address as server.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Out-Json($o) { Write-Output ($o | ConvertTo-Json -Compress -Depth 4) }

# HRESULTs that mean "credentials are not valid" (wrong password, expired, disabled, locked)
$invalidCodes = @(-2147023570, -2147023566, -2147023565, -2147022987, -2147022079, -2147024891)

try {
  $in     = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $user   = [string]$in.username
  $pass   = [string]$in.password
  $domain = [string]$in.domain
  $server = [string]$in.server
  if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrEmpty($pass)) { Out-Json @{ ok = $false }; exit 0 }

  Add-Type -AssemblyName System.DirectoryServices
  $auth = [System.DirectoryServices.AuthenticationTypes]::Secure

  $target = if (-not [string]::IsNullOrWhiteSpace($server)) { $server } elseif (-not [string]::IsNullOrWhiteSpace($domain)) { $domain } else { '' }
  $root = if ($target) { "LDAP://$target" } else { 'LDAP:/' + '/' }

  # login names to try: user@domain, then NETBIOS\user
  $names = @()
  if ($domain) { $names += "$user@$domain"; $names += (($domain.Split('.')[0]).ToUpper() + '\' + $user) } else { $names += $user }

  $de = $null; $bindName = $null; $invalid = $false; $lastErr = ''
  foreach ($n in $names) {
    try {
      $rootDse = New-Object System.DirectoryServices.DirectoryEntry("$root/RootDSE", $n, $pass, $auth)
      $nc = [string]$rootDse.Properties['defaultNamingContext'].Value
      if ([string]::IsNullOrWhiteSpace($nc)) { throw 'defaultNamingContext is empty' }
      $de = New-Object System.DirectoryServices.DirectoryEntry("$root/$nc", $n, $pass, $auth)
      $null = $de.NativeObject          # forces the bind
      $bindName = $n
      break
    } catch {
      $be = $_.Exception.GetBaseException()
      $code = 0
      if ($be -is [System.Runtime.InteropServices.COMException]) { $code = $be.ErrorCode }
      if ($invalidCodes -contains $code) { $invalid = $true } else { $lastErr = "$($be.GetType().Name) 0x$('{0:X8}' -f $code): $($be.Message)".Trim() }
      $de = $null
    }
  }
  if ($null -eq $de) {
    if ($invalid) { Out-Json @{ ok = $false }; exit 0 }
    Out-Json @{ ok = $false; error = ('bind failed: ' + $lastErr) }; exit 0
  }

  $ds = New-Object System.DirectoryServices.DirectorySearcher($de)
  $ds.Filter = "(&(objectCategory=person)(objectClass=user)(sAMAccountName=$user))"
  foreach ($p in @('samaccountname', 'displayname', 'mail', 'department', 'title', 'manager', 'memberof', 'useraccountcontrol')) { $null = $ds.PropertiesToLoad.Add($p) }
  $r = $ds.FindOne()
  if ($null -eq $r) { Out-Json @{ ok = $false }; exit 0 }

  function Prop($res, $name) { if ($res.Properties[$name].Count -gt 0) { return [string]$res.Properties[$name][0] } else { return '' } }

  $uac = 0; if ($r.Properties['useraccountcontrol'].Count -gt 0) { $uac = [int]$r.Properties['useraccountcontrol'][0] }
  $enabled = (($uac -band 2) -eq 0)

  $groups = @()
  foreach ($g in $r.Properties['memberof']) { $groups += (([string]$g -split ',')[0] -replace '^CN=', '') }

  $mgrSam = ''
  $mgrDn = Prop $r 'manager'
  if ($mgrDn) {
    try {
      $m = New-Object System.DirectoryServices.DirectoryEntry("$root/$mgrDn", $bindName, $pass, $auth)
      $mgrSam = [string]$m.Properties['samaccountname'].Value
    } catch { }
  }

  Out-Json @{
    ok = $true; username = (Prop $r 'samaccountname'); name = (Prop $r 'displayname'); email = (Prop $r 'mail')
    department = (Prop $r 'department'); title = (Prop $r 'title'); manager = $mgrSam; groups = $groups; enabled = $enabled
  }
} catch {
  Out-Json @{ ok = $false; error = ($_.Exception.GetBaseException().Message) }
}
