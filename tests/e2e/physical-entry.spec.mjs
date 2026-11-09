import {test,expect} from '@playwright/test';
import {installJourney} from '../support/journey.mjs';

test('manager explicitly saves physical race orders with lineup',
  async({page})=>{
    const fixture=await installJourney(page,{physical:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/signup');
    await page.getByLabel('Email',{exact:true}).fill(
      'physical-fixture@example.invalid');
    await page.getByLabel('Password',{exact:true}).fill(
      'only-a-local-ui-fixture');
    await page.getByRole('button',{name:'Create account →'}).click();
    await page.getByLabel('Team name').fill('Northern Lights Cycling');
    await page.getByRole('button',{name:'Create my team →'}).click();
    await page.goto('/team/run');
    await page.getByRole('button',{name:/The Coast Classic/}).click();
    await page.getByRole('button',{name:'Select the first eight'}).click();
    await page.getByRole('button',{name:'Choose captain',exact:true})
      .first().click();
    const tactics=page.getByRole('form',
      {name:'Physical race tactics'});
    await expect(tactics).toBeVisible();
    await expect(page.getByRole('button',{name:'Enter team'}))
      .toHaveCount(0);
    await tactics.getByLabel('Road captain').selectOption('rider-1');
    await tactics.getByLabel('Effort').selectOption('steady');
    await tactics.getByLabel('Chase').selectOption('selective');
    await tactics.getByRole('combobox',{name:'Attack',exact:true})
      .selectOption('selective');
    await tactics.getByLabel('Planned attacker')
      .selectOption('rider-2');
    await tactics.getByLabel('Front work')
      .selectOption('rotate');
    await tactics.getByRole('checkbox',{name:'Mateo Rojas'})
      .check();
    await tactics.getByLabel('Named front worker')
      .selectOption('rider-2');
    await tactics.getByRole('combobox',
      {name:'Sporting goal',exact:true})
      .selectOption('break_stage');
    await tactics.getByRole('combobox',
      {name:'Rider for sporting goal',exact:true})
      .selectOption('rider-2');
    await tactics.getByRole('button',
      {name:'Save lineup and race tactics'}).click();
    await expect(tactics.getByText(
      'Your lineup and physical race orders are saved.'))
      .toBeVisible();
    const entry=fixture.physicalEntry();
    expect(entry.selected_riders).toHaveLength(8);
    expect(entry.orders.baseline.attack).toBe('selective');
    expect(entry.orders.baseline.frontWorkRiderId).toBe('rider-2');
    expect(entry.stake.sportingGoal).toBe('break_stage');
    await page.reload();
    await page.getByRole('button',{name:/The Coast Classic/}).click();
    await expect(tactics.getByRole('combobox',
      {name:'Sporting goal',exact:true}))
      .toHaveValue('break_stage');
    expect(errors).toEqual([]);
  });
