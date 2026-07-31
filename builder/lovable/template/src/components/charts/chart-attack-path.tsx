import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AttackPath } from "@/components/charts/lib/socops"
const nodes = [
  { id: "vpn", kind: "entry" as const, label: "VPN, no MFA" },
  { id: "phish", kind: "entry" as const, label: "Phished laptop" },
  { id: "ws", kind: "host" as const, label: "Finance workstation" },
  { id: "svc", kind: "identity" as const, label: "Backup service account" },
  { id: "jump", kind: "host" as const, label: "Jump host" },
  { id: "dba", kind: "identity" as const, label: "DBA group" },
  { id: "db", kind: "data" as const, label: "Payments database" },
  { id: "hr", kind: "data" as const, label: "HR archive" },
]
const edges = [
  { from: "phish", to: "ws", technique: "Malicious attachment" },
  { from: "vpn", to: "jump", technique: "Reused credential" },
  { from: "ws", to: "svc", technique: "Cached credential in a scheduled task" },
  { from: "svc", to: "db", technique: "Service account is db_owner" },
  { from: "jump", to: "dba", technique: "Kerberoast" },
  { from: "dba", to: "db", technique: "Direct grant" },
  { from: "ws", to: "hr", technique: "Open file share" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attack path</CardTitle>
        <CardDescription>The shortest chain found by search</CardDescription>
      </CardHeader>
      <CardContent>
        <AttackPath nodes={nodes} edges={edges} target="db" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Break one link and the path is gone <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          To the payments database
        </div>
      </CardFooter>
    </Card>
  )
}
