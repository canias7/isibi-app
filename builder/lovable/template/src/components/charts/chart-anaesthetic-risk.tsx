import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AnaestheticRisk } from "@/components/charts/lib/vet"
const procedures = [
  { name: "Cat spay", patient: "Pixel", asa: 1, ageYears: 1, minutes: 45, bookedOrder: 1 },
  { name: "Dental, full mouth", patient: "Otto", asa: 3, ageYears: 13, minutes: 95, bookedOrder: 2 },
  { name: "Lump removal", patient: "Bramble", asa: 2, ageYears: 9, minutes: 55, bookedOrder: 3 },
  { name: "Cruciate repair", patient: "Juno", asa: 2, ageYears: 6, minutes: 130, bookedOrder: 4 },
  { name: "Cystotomy", patient: "Miso", asa: 4, ageYears: 11, minutes: 80, bookedOrder: 5 },
  { name: "Castration", patient: "Rufus", asa: 1, ageYears: 2, minutes: 30, bookedOrder: 6 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Theatre list</CardTitle>
        <CardDescription>Ordered by risk, not by who rang first</CardDescription>
      </CardHeader>
      <CardContent>
        <AnaestheticRisk procedures={procedures} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A composite you can argue with <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Tuesday
        </div>
      </CardFooter>
    </Card>
  )
}
