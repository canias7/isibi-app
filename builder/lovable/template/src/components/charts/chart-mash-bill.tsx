import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MashBill } from "@/components/charts/lib/spirits"
const bills = [
  { name: "Bourbon, high rye", grains: [
    { name: "Maize", kg: 600, extractPercent: 72 },
    { name: "Rye", kg: 280, extractPercent: 58 },
    { name: "Malted barley", kg: 120, extractPercent: 80 }] },
  { name: "Wheated bourbon", grains: [
    { name: "Maize", kg: 700, extractPercent: 72 },
    { name: "Wheat", kg: 180, extractPercent: 76 },
    { name: "Malted barley", kg: 120, extractPercent: 80 }] },
  { name: "Single malt", grains: [
    { name: "Malted barley", kg: 1000, extractPercent: 80 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mash bill</CardTitle>
        <CardDescription>By weight and by fermentable extract</CardDescription>
      </CardHeader>
      <CardContent>
        <MashBill bills={bills} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A 20% rye mash bill is a weight, not a contribution <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three recipes
        </div>
      </CardFooter>
    </Card>
  )
}
