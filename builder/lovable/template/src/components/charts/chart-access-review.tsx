import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AccessReview } from "@/components/charts/lib/socops"
const grants = [
  { principal: "a.moreau", role: "prod-admin", lastUsedDays: 3, lastApprovedDays: 41, privileged: true },
  { principal: "svc-backup", role: "db-owner", lastUsedDays: 1, lastApprovedDays: 412, privileged: true },
  { principal: "j.okafor", role: "prod-admin", lastUsedDays: 186, lastApprovedDays: 88, privileged: true },
  { principal: "contractor-14", role: "deploy", lastUsedDays: null, lastApprovedDays: 264, privileged: true },
  { principal: "t.lindqvist", role: "read-only", lastUsedDays: 12, lastApprovedDays: 60, privileged: false },
  { principal: "m.aduba", role: "billing", lastUsedDays: 140, lastApprovedDays: 210, privileged: false },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access review</CardTitle>
        <CardDescription>Last use against last approval</CardDescription>
      </CardHeader>
      <CardContent>
        <AccessReview grants={grants} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A stale privileged grant is inherited silently <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Quarterly review
        </div>
      </CardFooter>
    </Card>
  )
}
