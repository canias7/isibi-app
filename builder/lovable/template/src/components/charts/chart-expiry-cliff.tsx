import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ExpiryCliff } from "@/components/charts/lib/patents"
const patents = [
  { name: "Core formulation", expiryYear: 2029, annualRevenue: 84_000_000 },
  { name: "Delivery device", expiryYear: 2031, annualRevenue: 26_000_000 },
  { name: "Dosing regimen", expiryYear: 2033, annualRevenue: 18_000_000 },
  { name: "Polymorph B", expiryYear: 2029, annualRevenue: 12_000_000 },
  { name: "Manufacturing route", expiryYear: 2036, annualRevenue: 9_000_000 },
  { name: "Combination", expiryYear: 2038, annualRevenue: 21_000_000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expiry cliff</CardTitle>
        <CardDescription>Protected revenue year by year</CardDescription>
      </CardHeader>
      <CardContent>
        <ExpiryCliff patents={patents} fromYear={2026} toYear={2040} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One year takes half the portfolio <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six patents
        </div>
      </CardFooter>
    </Card>
  )
}
