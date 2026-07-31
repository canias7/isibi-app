import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GrantPipeline } from "@/components/charts/lib/fundraising"
const applications = [
  { name: "Wolfson", amount: 250000, stage: "Submitted" },
  { name: "Esmée Fairbairn", amount: 180000, stage: "Submitted" },
  { name: "City Bridge", amount: 140000, stage: "Invited" },
  { name: "Garfield Weston", amount: 100000, stage: "Invited" },
  { name: "Henry Smith", amount: 90000, stage: "In conversation" },
  { name: "Tudor Trust", amount: 75000, stage: "In conversation" },
  { name: "Local authority", amount: 60000, stage: "Identified" },
  { name: "Rank Foundation", amount: 45000, stage: "Identified" },
  { name: "Postcode Lottery", amount: 200000, stage: "Identified" },
]
const stageProbability = { Identified: 0.1, "In conversation": 0.3, Invited: 0.55, Submitted: 0.35 }
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grant pipeline</CardTitle>
        <CardDescription>Weighted by what each stage converts</CardDescription>
      </CardHeader>
      <CardContent>
        <GrantPipeline applications={applications} stageProbability={stageProbability} targetIncome={320000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A pipeline total is how a board is surprised in March <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Trusts and foundations
        </div>
      </CardFooter>
    </Card>
  )
}
