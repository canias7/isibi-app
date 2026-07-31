import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KillChain } from "@/components/charts/lib/netsec"
const stages = [
  { name: "Recon", observed: true, detected: false, blocked: false, at: "day -14" },
  { name: "Weaponise", observed: false, detected: false, blocked: false },
  { name: "Deliver", observed: true, detected: true, blocked: false, at: "09:12" },
  { name: "Exploit", observed: true, detected: true, blocked: false, at: "09:14" },
  { name: "Install", observed: true, detected: true, blocked: true, at: "09:16" },
  { name: "C2", observed: false, detected: false, blocked: false },
  { name: "Act", observed: false, detected: false, blocked: false },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How far it got</CardTitle>
        <CardDescription>Stage by stage</CardDescription>
      </CardHeader>
      <CardContent>
        <KillChain stages={stages} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every later control means it got further <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One intrusion
        </div>
      </CardFooter>
    </Card>
  )
}
